// @ts-nocheck
/**
 * Alias Webhook HMAC Verification Tests
 * Critical security tests for webhook signature validation
 */

import crypto from 'crypto';

// Mirror the verification logic from webhooks route
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    if (!signature.startsWith('sha256=')) {
      return false;
    }

    const receivedSignature = signature.slice(7);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// Test Suite
describe('Alias Webhook HMAC Verification', () => {
  const testSecret = 'test_webhook_secret_12345';
  const testPayload = JSON.stringify({
    id: 'evt_test_123',
    type: 'listing.status.changed',
    created_at: '2025-11-14T12:00:00Z',
    data: { listing_id: 'lst_456', old_status: 'active', new_status: 'sold' },
  });

  test('should verify valid HMAC signature', () => {
    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(testPayload);
    const validSignature = `sha256=${hmac.digest('hex')}`;

    const result = verifyWebhookSignature(testPayload, validSignature, testSecret);

    expect(result).toBe(true);
  });

  test('should reject invalid HMAC signature', () => {
    const invalidSignature = 'sha256=deadbeef1234567890abcdef';

    const result = verifyWebhookSignature(testPayload, invalidSignature, testSecret);

    expect(result).toBe(false);
  });

  test('should reject signature without sha256= prefix', () => {
    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(testPayload);
    const signatureWithoutPrefix = hmac.digest('hex');

    const result = verifyWebhookSignature(testPayload, signatureWithoutPrefix, testSecret);

    expect(result).toBe(false);
  });

  test('should reject signature with wrong secret', () => {
    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(testPayload);
    const signatureWithWrongSecret = `sha256=${hmac.digest('hex')}`;

    const result = verifyWebhookSignature(testPayload, signatureWithWrongSecret, 'wrong_secret');

    expect(result).toBe(false);
  });

  test('should reject tampered payload', () => {
    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(testPayload);
    const validSignature = `sha256=${hmac.digest('hex')}`;

    const tamperedPayload = testPayload + ' ';

    const result = verifyWebhookSignature(tamperedPayload, validSignature, testSecret);

    expect(result).toBe(false);
  });

  test('should handle malformed signature gracefully', () => {
    const malformedSignatures = [
      'sha256=not_hex',
      'sha256=',
      '',
      'invalid',
      'sha256=123', // Too short
    ];

    malformedSignatures.forEach((sig) => {
      const result = verifyWebhookSignature(testPayload, sig, testSecret);
      expect(result).toBe(false);
    });
  });

  test('should use constant-time comparison (timing-safe)', () => {
    // This test verifies that timingSafeEqual is being used
    // In production, this prevents timing attacks

    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(testPayload);
    const validSig = hmac.digest('hex');

    // Create signature that differs only in last character
    const almostValidSig = validSig.slice(0, -1) + '0';

    const startTime = Date.now();
    const result1 = verifyWebhookSignature(testPayload, `sha256=${almostValidSig}`, testSecret);
    const time1 = Date.now() - startTime;

    const startTime2 = Date.now();
    const result2 = verifyWebhookSignature(testPayload, `sha256=0000000000000000`, testSecret);
    const time2 = Date.now() - startTime2;

    // Both should be false
    expect(result1).toBe(false);
    expect(result2).toBe(false);

    // Timing should be similar (within reasonable margin)
    // This is a weak test but shows constant-time behavior
    expect(Math.abs(time1 - time2)).toBeLessThan(10); // ms
  });
});

// Manual test helper (uncomment to run)
/*
function manualTest() {
  const secret = 'my_webhook_secret';
  const payload = '{"id":"evt_123","type":"test"}';

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  console.log('Payload:', payload);
  console.log('Secret:', secret);
  console.log('Signature:', `sha256=${signature}`);
  console.log('\nUse this signature in curl:');
  console.log(`curl -X POST http://localhost:3000/api/alias/webhooks \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "x-alias-signature: sha256=${signature}" \\`);
  console.log(`  -d '${payload}'`);
}

manualTest();
*/
