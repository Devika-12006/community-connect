import { describe, it, expect } from 'vitest';
import { suggestCategory, checkPossibleDuplicate, suggestPriority } from './smartAssistance';
import type { Complaint } from '../types';

describe('Smart Assistance Utilities', () => {
  describe('suggestCategory', () => {
    it('suggests Water Leakage when pipe/leak keywords are present', () => {
      const match = suggestCategory('Pipe broken in basement', 'Water is leaking continuously');
      expect(match).not.toBeNull();
      expect(match?.category).toBe('Water Leakage');
    });

    it('suggests Streetlights when streetlight/lamp keywords are present', () => {
      const match = suggestCategory('Streetlight flickering', 'The pole lamp in front of Block B is dark');
      expect(match).not.toBeNull();
      expect(match?.category).toBe('Streetlights');
    });

    it('suggests Common-Area Electrical when spark keywords are present', () => {
      const match = suggestCategory('Sparks in meter room', 'The electrical breaker box is emitting sparks');
      expect(match).not.toBeNull();
      expect(match?.category).toBe('Common-Area Electrical');
    });

    it('returns null when text is empty or has no matching keywords', () => {
      const match = suggestCategory('', '');
      expect(match).toBeNull();
    });
  });

  describe('checkPossibleDuplicate', () => {
    const existingComplaints: Complaint[] = [
      {
        id: 'c-1',
        reference: 'CC-2026-001',
        residentId: 'r-1',
        residentName: 'Test Resident',
        residentBlock: 'Block A',
        title: 'Broken water pipe near lift',
        description: 'Water leaking in corridor',
        category: 'Water Leakage',
        block: 'Block A',
        specificLocation: 'Ground floor',
        priority: 'High',
        status: 'In Progress',
        originalImageIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('flags duplicate when title keywords and category match open complaint in same block', () => {
      const result = checkPossibleDuplicate(
        'Water pipe broken near elevator',
        'Water Leakage',
        'Block A',
        existingComplaints
      );
      expect(result.hasDuplicate).toBe(true);
      expect(result.similarComplaint?.reference).toBe('CC-2026-001');
    });

    it('does not flag duplicate if block is different', () => {
      const result = checkPossibleDuplicate(
        'Water pipe broken near elevator',
        'Water Leakage',
        'Block C',
        existingComplaints
      );
      expect(result.hasDuplicate).toBe(false);
    });
  });

  describe('suggestPriority', () => {
    it('suggests Urgent when resident explicitly requested urgent attention', () => {
      const result = suggestPriority('Garbage', true, 'Pile accumulating');
      expect(result.priority).toBe('Urgent');
      expect(result.reason).toContain('Resident explicitly requested urgent attention');
    });

    it('suggests Urgent for electrical hazards with sparks/fire', () => {
      const result = suggestPriority('Common-Area Electrical', false, 'Live wire is emitting sparks');
      expect(result.priority).toBe('Urgent');
    });

    it('suggests Low for standard road defects', () => {
      const result = suggestPriority('Roads and Potholes', false, 'Minor crack on driveway');
      expect(result.priority).toBe('Low');
    });
  });
});
