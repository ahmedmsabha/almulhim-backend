import {
  receiptValidationErrorMessage,
  validateReceiptObjectMetadata,
} from './receipt-object.validation';

describe('receipt-object.validation', () => {
  it('accepts valid receipt metadata', () => {
    expect(
      validateReceiptObjectMetadata({
        contentType: 'image/jpeg',
        contentLength: 1024,
      }),
    ).toEqual({ valid: true, contentType: 'image/jpeg' });
  });

  it('rejects missing objects', () => {
    expect(validateReceiptObjectMetadata(null)).toEqual({
      valid: false,
      error: 'missing',
    });
    expect(receiptValidationErrorMessage('missing')).toBe(
      'Receipt file was not found in storage',
    );
  });
});
