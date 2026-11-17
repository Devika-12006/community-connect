import { repository } from '../db/repository';
import { aiComplaintService } from './aiComplaintService';
import { contactMatchingEngine } from './contactMatchingEngine';
import type {
  Complaint,
  Notification,
  WhatsAppOutgoingReply,
  ComplaintAssignmentRecord,
  AuditLogEntry,
} from '../types';

export interface RouteComplaintResult {
  complaint: Complaint;
  outgoingReply: WhatsAppOutgoingReply;
  assignment?: ComplaintAssignmentRecord;
}

export const complaintRoutingService = {
  /**
   * Process an incoming message from Inbound AI, Webhook, or Direct entry
   */
  async processIncomingMessage(input: {
    messageText: string;
    reporterPhone: string;
    reporterName?: string;
    organizationId?: string;
    externalMessageId?: string;
    source?: 'Inbound AI' | 'Webhook' | 'Web' | 'Other';
  }): Promise<RouteComplaintResult> {
    const config = await repository.getIntegrationConfig();
    const organizationId = input.organizationId || config.defaultOrganizationId || 'org-rwa-1';
    const source = input.source || 'Inbound AI';
    const now = new Date().toISOString();

    // 1. AI Complaint Understanding
    const analysis = await aiComplaintService.analyzeComplaint(input.messageText);

    // 2. Contact Matching & Explainable Routing
    const matchResult = await contactMatchingEngine.matchContact(organizationId, analysis);

    // 3. Generate Complaint Ticket
    const reference = await repository.getNextReference();
    const complaintId = crypto.randomUUID();

    // Determine initial status based on routing
    let initialStatus: Complaint['status'] = 'Pending';
    let assignedWorkerId: string | undefined = undefined;

    // Check if recommended contact corresponds to an existing app worker
    if (matchResult.recommendedContact) {
      const workers = await repository.getWorkers();
      const matchedWorker = workers.find(
        (w) =>
          w.name.toLowerCase() === matchResult.recommendedContact!.name.toLowerCase() ||
          (matchResult.recommendedContact!.phoneNumber &&
            w.contactNumber &&
            w.contactNumber.replace(/[^\d]/g, '') === matchResult.recommendedContact!.phoneNumber.replace(/[^\d]/g, ''))
      );

      if (matchedWorker && matchResult.routingStatus === 'Auto-Routed') {
        assignedWorkerId = matchedWorker.id;
        initialStatus = 'Assigned';
      }
    }

    const complaint: Complaint = {
      id: complaintId,
      reference,
      residentId: 'inbound-reporter',
      residentName: input.reporterName || 'Resident Report',
      residentBlock: analysis.location || 'General',
      block: analysis.location || 'General',
      specificLocation: analysis.location || 'Unspecified Location',
      title: analysis.summary || `${analysis.category} issue reported`,
      description: analysis.description,
      category: analysis.category,
      location: analysis.location,
      priority: analysis.urgency === 'Emergency' ? 'Urgent' : analysis.urgency === 'High' ? 'High' : analysis.urgency === 'Low' ? 'Low' : 'Medium',
      urgency: analysis.urgency,
      status: initialStatus,
      source,
      externalMessageId: input.externalMessageId || `wam-${Date.now()}`,
      reporterPhone: input.reporterPhone,
      organizationId,
      recommendedContactId: matchResult.recommendedContact?.id,
      matchScore: matchResult.matchScore,
      matchReason: matchResult.matchReason,
      supportingMessageEvidence: matchResult.supportingEvidence,
      needsClarification: analysis.needsClarification,
      clarificationQuestion: analysis.clarificationQuestion,
      routingStatus: matchResult.routingStatus,
      assignedWorkerId,
      originalImageIds: [],
      verificationAttempts: [],
      isSuspicious: false,
      escalated: analysis.urgency === 'Emergency',
      priorityRank: analysis.urgency === 'Emergency' ? 1 : analysis.urgency === 'High' ? 2 : 3,
      createdAt: now,
      updatedAt: now,
    };

    await repository.saveComplaint(complaint);

    // 4. Create Assignment Record
    let assignment: ComplaintAssignmentRecord | undefined = undefined;
    if (matchResult.recommendedContact) {
      assignment = {
        id: crypto.randomUUID(),
        complaintId: complaint.id,
        contactId: matchResult.recommendedContact.id,
        organizationId,
        matchScore: matchResult.matchScore,
        matchReason: matchResult.matchReason,
        assignmentStatus: matchResult.routingStatus === 'Auto-Routed' ? 'Auto-Assigned' : 'Suggested',
        assignedBy: 'AI Agent',
        candidateRank: 1,
        breakdown: {
          categoryScore: matchResult.candidates[0]?.breakdown?.categoryScore ?? 0,
          locationScore: matchResult.candidates[0]?.breakdown?.locationScore ?? 0,
          roleScore: matchResult.candidates[0]?.breakdown?.roleScore ?? 0,
          evidenceScore: matchResult.candidates[0]?.breakdown?.evidenceScore ?? 0,
        },
        createdAt: now,
      };
      await repository.saveAssignment(assignment);
    }

    // 5. Create Complaint Timeline Events
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      eventType: 'Created',
      action: `Complaint received via ${source}`,
      actorRole: 'System',
      actorName: 'AI Complaint Agent',
      visibility: 'public',
      note: `Received message from ${input.reporterPhone}. AI analyzed: Category "${analysis.category}", Urgency "${analysis.urgency}", Location "${analysis.location}".`,
      createdAt: now,
    });

    if (matchResult.recommendedContact) {
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: complaint.id,
        eventType: 'Assigned',
        action: `Contact Recommended: ${matchResult.recommendedContact.name} (${matchResult.matchScore}%)`,
        actorRole: 'System',
        actorName: 'AI Routing Engine',
        visibility: 'internal',
        note: matchResult.matchReason,
        createdAt: new Date(Date.now() + 500).toISOString(),
      });
    }

    // 6. Notify Community Manager
    const managerNotif: Notification = {
      id: crypto.randomUUID(),
      recipientRole: 'Manager',
      recipientId: 'ALL',
      title: `New Inbound Complaint: ${complaint.reference}`,
      message: `${complaint.title} (${complaint.category}) at ${complaint.specificLocation || complaint.block}. ${
        matchResult.recommendedContact
          ? `Recommended contact: ${matchResult.recommendedContact.name} (${matchResult.matchScore}% confidence).`
          : 'Requires manager review.'
      }`,
      complaintId: complaint.id,
      createdAt: now,
    };
    await repository.addNotification(managerNotif);

    // 7. Audit Log
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      organizationId,
      actorId: 'ai-agent',
      actorName: 'Inbound AI Agent',
      action: 'ROUTED_COMPLAINT',
      recordType: 'COMPLAINT',
      recordId: complaint.id,
      details: {
        reference: complaint.reference,
        category: complaint.category,
        location: complaint.specificLocation || complaint.block,
        recommendedContact: matchResult.recommendedContact?.name || null,
        matchScore: matchResult.matchScore,
        routingStatus: matchResult.routingStatus,
      },
      createdAt: now,
    };
    await repository.addAuditLog(auditEntry);

    // 8. Generate Inbound Response Message
    let replyText = '';
    if (analysis.needsClarification && analysis.clarificationQuestion) {
      replyText = `Hello! We received your report regarding "${analysis.category}". We've opened ticket *#${complaint.reference}*.\n\n${analysis.clarificationQuestion}\n\nYou can reply directly to this message with the details!`;
    } else if (matchResult.recommendedContact) {
      replyText = `Hello! Your complaint has been received and registered under ticket *#${complaint.reference}*.\n\n*Summary:* ${analysis.summary || complaint.title}\n*Category:* ${complaint.category}\n*Location:* ${complaint.specificLocation || complaint.block}\n*Urgency:* ${complaint.urgency}\n*Assigned / Recommended Contact:* ${matchResult.recommendedContact.name} (${matchResult.recommendedContact.role})\n\nOur team is working on this. We will notify you here when the status is updated!`;
    } else {
      replyText = `Hello! Your complaint has been registered under ticket *#${complaint.reference}*.\n\n*Summary:* ${analysis.summary || complaint.title}\n*Status:* Routed to Community Manager for manual dispatch.\n\nWe will update you as soon as a technician is assigned.`;
    }

    const outgoingReply: WhatsAppOutgoingReply = {
      toPhone: input.reporterPhone,
      messageText: replyText,
      complaintReference: complaint.reference,
      status: 'Sent',
      timestamp: new Date().toISOString(),
    };

    return {
      complaint,
      outgoingReply,
      assignment,
    };
  },

  /**
   * Manually override or re-assign contact for a complaint
   */
  async reassignContact(
    complaintId: string,
    contactId: string,
    managerName: string,
    reason?: string
  ): Promise<Complaint> {
    const complaint = await repository.getComplaint(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const contact = await repository.getContact(contactId);
    if (!contact) throw new Error('Contact not found');

    const now = new Date().toISOString();
    complaint.recommendedContactId = contact.id;
    complaint.routingStatus = 'Recommended';
    complaint.updatedAt = now;

    // Check if worker matches
    const workers = await repository.getWorkers();
    const matchedWorker = workers.find(
      (w) => w.name.toLowerCase() === contact.name.toLowerCase()
    );
    if (matchedWorker) {
      complaint.assignedWorkerId = matchedWorker.id;
      complaint.status = 'Assigned';
    }

    await repository.saveComplaint(complaint);

    // Save assignment record
    await repository.saveAssignment({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      contactId: contact.id,
      organizationId: complaint.organizationId || 'org-rwa-1',
      matchScore: 100,
      matchReason: `Manual assignment by ${managerName}: ${reason || 'Manager reassigned contact.'}`,
      assignmentStatus: 'Manager-Assigned',
      assignedBy: managerName,
      candidateRank: 1,
      breakdown: { categoryScore: 40, locationScore: 30, roleScore: 20, evidenceScore: 10 },
      createdAt: now,
    });

    // Add event
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      eventType: 'Assigned',
      action: `Assigned to ${contact.name} (${contact.role})`,
      actorRole: 'Manager',
      actorName: managerName,
      visibility: 'internal',
      note: reason || 'Manager updated contact assignment.',
      createdAt: now,
    });

    // Audit log
    await repository.addAuditLog({
      id: crypto.randomUUID(),
      organizationId: complaint.organizationId || 'org-rwa-1',
      actorId: 'manager',
      actorName: managerName,
      action: 'REASSIGN_CONTACT',
      recordType: 'COMPLAINT',
      recordId: complaint.id,
      details: { contactName: contact.name, reason },
      createdAt: now,
    });

    return complaint;
  },
};
