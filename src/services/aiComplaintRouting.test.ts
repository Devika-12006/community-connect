import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { aiComplaintService } from './aiComplaintService';
import { contactMatchingEngine } from './contactMatchingEngine';
import { contactService } from './contactService';
import { groupMessageService } from './groupMessageService';
import { webhookService } from './webhookService';
import { repository } from '../db/repository';
import type { Contact, AuthorizedGroupMessage } from '../types';

describe('AI Complaint Understanding (aiComplaintService)', () => {
  it('correctly classifies streetlights category and detects location', () => {
    const text = 'Streetlight not working near Block C children playground for 2 days.';
    const analysis = aiComplaintService.analyzeLocal(text);

    expect(analysis.category).toBe('Streetlights');
    expect(analysis.location).toContain('Block C');
    expect(analysis.needsClarification).toBe(false);
  });

  it('correctly classifies water leakage and flags emergency urgency for bursts', () => {
    const text = 'Urgent! Heavy water leakage and overhead pipe burst on Block B terrace.';
    const analysis = aiComplaintService.analyzeLocal(text);

    expect(analysis.category).toBe('Water Leakage');
    expect(analysis.location).toContain('Block B');
    expect(analysis.urgency).toBe('Emergency');
    expect(analysis.needsClarification).toBe(false);
  });

  it('correctly classifies garbage issue in clubhouse', () => {
    const text = 'Dry and wet waste bins near the Clubhouse entrance are overflowing with trash.';
    const analysis = aiComplaintService.analyzeLocal(text);

    expect(analysis.category).toBe('Garbage');
    expect(analysis.location).toContain('Clubhouse');
    expect(analysis.urgency).toBe('High');
  });

  it('detects missing location and generates polite clarification question', () => {
    const text = 'Please send an electrician immediately to fix the broken spark wire.';
    const analysis = aiComplaintService.analyzeLocal(text);

    expect(analysis.needsClarification).toBe(true);
    expect(analysis.clarificationQuestion).toBeTruthy();
    expect(analysis.clarificationQuestion).toContain('specify the exact location');
  });
});

describe('Contact Matching & Explainable Routing Engine (contactMatchingEngine)', () => {
  const orgId = 'test-org-1';

  const mockContacts: Contact[] = [
    {
      id: 'c-elec-verified',
      organizationId: orgId,
      name: 'Rajesh Varma',
      role: 'Lead Electrician',
      department: 'Electrical Maintenance',
      phoneNumber: '+919876543210',
      categories: ['Streetlights', 'Common-Area Electrical'],
      serviceAreas: ['Block C', 'Common Grounds'],
      verified: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c-elec-unverified',
      organizationId: orgId,
      name: 'Unverified Handyman',
      role: 'Electrician',
      department: 'External Vendor',
      phoneNumber: '+919876543299',
      categories: ['Streetlights', 'Common-Area Electrical'],
      serviceAreas: ['Block C'],
      verified: false, // Strict verification constraint
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c-elec-inactive',
      organizationId: orgId,
      name: 'Retired Electrician',
      role: 'Electrician',
      department: 'Electrical Maintenance',
      phoneNumber: '+919876543288',
      categories: ['Streetlights'],
      serviceAreas: ['Block C'],
      verified: true,
      active: false, // Strict active constraint
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c-plumb-verified',
      organizationId: orgId,
      name: 'Manoj Kumar',
      role: 'Senior Plumber',
      department: 'Water & Sanitation',
      phoneNumber: '+919876543212',
      categories: ['Water Leakage', 'Drainage'],
      serviceAreas: ['Block B', 'Clubhouse'],
      verified: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c-other-org',
      organizationId: 'other-org-2', // Different organization
      name: 'Municipal Officer',
      role: 'Nodal Officer',
      department: 'Municipal',
      phoneNumber: '+919876543215',
      categories: ['Streetlights'],
      serviceAreas: ['Block C'],
      verified: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    // Reset and seed mock contacts
    for (const c of mockContacts) {
      await repository.saveContact(c);
    }
  });

  it('matches top verified electrician for streetlight issue in Block C', async () => {
    const analysis = aiComplaintService.analyzeLocal('Streetlight broken at Block C playground.');
    const result = await contactMatchingEngine.matchContact(orgId, analysis);

    expect(result.recommendedContact).toBeTruthy();
    expect(result.recommendedContact?.id).toBe('c-elec-verified');
    expect(result.matchScore).toBeGreaterThanOrEqual(70);
    expect(result.matchReason).toContain('Rajesh Varma');
  });

  it('strictly excludes unverified and inactive contacts from consideration', async () => {
    const analysis = aiComplaintService.analyzeLocal('Streetlight broken at Block C playground.');
    const result = await contactMatchingEngine.matchContact(orgId, analysis);

    const candidateIds = result.candidates.map((c) => c.contactId);
    expect(candidateIds).not.toContain('c-elec-unverified');
    expect(candidateIds).not.toContain('c-elec-inactive');
  });

  it('strictly enforces organization data boundary', async () => {
    const analysis = aiComplaintService.analyzeLocal('Streetlight broken at Block C playground.');
    const result = await contactMatchingEngine.matchContact(orgId, analysis);

    const candidateIds = result.candidates.map((c) => c.contactId);
    expect(candidateIds).not.toContain('c-other-org');
  });

  it('incorporates authorized group message evidence into explainable score', async () => {
    const notice: AuthorizedGroupMessage = {
      id: 'notice-test-1',
      organizationId: orgId,
      sourceName: 'Security Bulletin',
      sourceType: 'Admin Notice',
      messageText: 'Electrician Rajesh Varma is inspecting all playground lighting today.',
      messageTimestamp: new Date().toISOString(),
      permissionStatus: 'Authorized',
      importedBy: 'Admin',
      categoryTag: 'Streetlights',
      locationTag: 'Block C',
      createdAt: new Date().toISOString(),
    };
    await repository.saveGroupMessage(notice);

    const analysis = aiComplaintService.analyzeLocal('Streetlight broken at Block C playground.');
    const result = await contactMatchingEngine.matchContact(orgId, analysis);

    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(result.supportingEvidence.length).toBeGreaterThan(0);
  });
});

describe('Contact Service (contactService)', () => {
  it('normalizes 10-digit Indian numbers and cleans whitespace', () => {
    expect(contactService.normalizePhoneNumber('9876543210')).toBe('+919876543210');
    expect(contactService.normalizePhoneNumber('+91 98765-43210')).toBe('+919876543210');
  });

  it('exports and imports contacts CSV correctly', async () => {
    const sampleCSV = `name,role,department,phoneNumber,email,categories,serviceAreas,verified,active,notes\n"Amit Patel","Electrician","Maintenance","+919876543255","amit@test.org","Streetlights","Block A","true","true","Senior tech"`;
    const res = await contactService.importFromCSV('test-org-csv', sampleCSV, 'Tester');

    expect(res.importedCount).toBe(1);
    expect(res.contacts[0].name).toBe('Amit Patel');
    expect(res.contacts[0].phoneNumber).toBe('+919876543255');

    const exported = contactService.exportToCSV(res.contacts);
    expect(exported).toContain('Amit Patel');
    expect(exported).toContain('+919876543255');
  });
});

describe('Group Message Service (groupMessageService)', () => {
  it('rejects unauthorized message imports', async () => {
    const unauthorizedCSV = `sourceName,sourceType,messageText,messageTimestamp,permissionStatus,importedBy,categoryTag,locationTag\n"Secret Group","Chat","Leaked chat message","2026-03-01","Unauthorized","Scraper","Water Leakage","Block A"`;
    const res = await groupMessageService.importFromCSV('test-org-perm', unauthorizedCSV, 'Tester');

    expect(res.importedCount).toBe(0);
    expect(res.skippedCount).toBe(1);
  });
});

describe('Inbound Webhook Verification & Parsing (webhookService)', () => {
  it('validates webhook challenge when token matches', () => {
    const result = webhookService.verifyWebhook(
      'subscribe',
      'my_secret_token_123',
      'challenge_9876',
      'my_secret_token_123'
    );
    expect(result.valid).toBe(true);
    expect(result.challenge).toBe('challenge_9876');
  });

  it('rejects webhook handshake when token is invalid', () => {
    const result = webhookService.verifyWebhook(
      'subscribe',
      'wrong_token',
      'challenge_9876',
      'my_secret_token_123'
    );
    expect(result.valid).toBe(false);
  });

  it('parses incoming webhook payload correctly', () => {
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550234567',
                  phone_number_id: '10987654321',
                },
                contacts: [
                  {
                    profile: { name: 'Priya Sharma' },
                    wa_id: '919876543210',
                  },
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLMzkxOTg3NjU0MzIxMAUCABEYEjE=',
                    timestamp: '1772600000',
                    text: {
                      body: 'Streetlight pole broken near Block C playground.',
                    },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const parsed = webhookService.parseWebhookPayload(metaPayload);
    expect(parsed).toBeTruthy();
    expect(parsed?.fromName).toBe('Priya Sharma');
    expect(parsed?.fromPhone).toBe('919876543210');
    expect(parsed?.messageText).toBe('Streetlight pole broken near Block C playground.');
  });
});
