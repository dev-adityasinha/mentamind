import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient before importing the module
vi.mock('@prisma/client', () => {
  const mockCreate = vi.fn().mockResolvedValue({});
  return {
    PrismaClient: vi.fn(() => ({
      auditLog: {
        create: mockCreate,
      },
    })),
    __mockCreate: mockCreate,
  };
});

import { createAuditLog } from '../../src/middleware/audit';
import { PrismaClient } from '@prisma/client';

describe('Audit Logging', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mock from the mocked module
    const prisma = new PrismaClient() as any;
    mockCreate = prisma.auditLog.create;
  });

  it('creates an audit log entry with correct data', async () => {
    const req = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'test-agent' },
    } as any;

    await createAuditLog('user-123', {
      action: 'TEST_ACTION',
      entityType: 'TestEntity',
      entityId: 'entity-456',
      oldValue: { status: 'old' },
      newValue: { status: 'new' },
    }, req);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-123',
        action: 'TEST_ACTION',
        entityType: 'TestEntity',
        entityId: 'entity-456',
      }),
    });
  });

  it('uses "N/A" as entityId when none is provided', async () => {
    await createAuditLog('user-123', {
      action: 'TEST_ACTION',
      entityType: 'TestEntity',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: 'N/A',
      }),
    });
  });

  it('does not throw when prisma.create fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    await expect(
      createAuditLog('user-123', {
        action: 'TEST_ACTION',
        entityType: 'TestEntity',
      })
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('handles missing request gracefully', async () => {
    await createAuditLog('user-123', {
      action: 'TEST_ACTION',
      entityType: 'TestEntity',
      entityId: 'entity-789',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: null,
        userAgent: null,
      }),
    });
  });
});
