export class PaymentProviderException extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly isRetryable: boolean = false,
    public readonly originalError?: any,
    public readonly statusCode: number = 502,
  ) {
    super(message);
    this.name = 'PaymentProviderException';
  }

  get retryable(): boolean {
    return this.isRetryable;
  }
}

export class ProviderTimeoutException extends PaymentProviderException {
  constructor(provider: string, message: string = 'Provider request timed out', originalError?: any) {
    super(message, provider, true, originalError, 504);
    this.name = 'ProviderTimeoutException';
  }
}

export class ProviderNetworkException extends PaymentProviderException {
  constructor(provider: string, message: string = 'Network failure communicating with payment provider', originalError?: any) {
    super(message, provider, true, originalError, 503);
    this.name = 'ProviderNetworkException';
  }
}

export class ProviderAuthenticationException extends PaymentProviderException {
  constructor(provider: string, message: string = 'Authentication failed with payment provider', originalError?: any) {
    super(message, provider, false, originalError, 401);
    this.name = 'ProviderAuthenticationException';
  }
}

export class ProviderValidationException extends PaymentProviderException {
  constructor(provider: string, message: string = 'Invalid request parameters for provider', originalError?: any) {
    super(message, provider, false, originalError, 400);
    this.name = 'ProviderValidationException';
  }
}

export class ProviderAmountMismatchException extends PaymentProviderException {
  constructor(
    provider: string,
    public readonly expectedAmount: string | number,
    public readonly receivedAmount: string | number,
  ) {
    super(
      `Provider reported amount ${receivedAmount} does not match expected amount ${expectedAmount}`,
      provider,
      false,
      undefined,
      400,
    );
    this.name = 'ProviderAmountMismatchException';
  }
}

export class ProviderCurrencyMismatchException extends PaymentProviderException {
  constructor(
    provider: string,
    public readonly expectedCurrency: string,
    public readonly receivedCurrency: string,
  ) {
    super(
      `Provider reported currency ${receivedCurrency} does not match expected currency ${expectedCurrency}`,
      provider,
      false,
      undefined,
      400,
    );
    this.name = 'ProviderCurrencyMismatchException';
  }
}

export class ProviderSignatureException extends PaymentProviderException {
  constructor(provider: string, message: string = 'Invalid provider webhook signature') {
    super(message, provider, false, undefined, 401);
    this.name = 'ProviderSignatureException';
  }
}
