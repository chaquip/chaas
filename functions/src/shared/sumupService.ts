interface CreateCheckoutParams {
  amount: number;
  currency: string;
  checkoutReference: string;
  description: string;
  merchantCode: string;
  returnUrl: string;
}

interface CreateCheckoutResponse {
  checkoutId: string;
  checkoutUrl: string;
}

/**
 * Creates a one-time checkout link with SumUp
 */
export async function createCheckout(
  params: CreateCheckoutParams,
): Promise<CreateCheckoutResponse> {
  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) {
    throw new Error('SUMUP_API_KEY not configured');
  }

  const requestBody = {
    amount: params.amount,
    currency: params.currency,
    checkout_reference: params.checkoutReference,
    description: params.description,
    merchant_code: params.merchantCode,
    return_url: params.returnUrl,
    hosted_checkout: {
      enabled: true,
    },
  };

  try {
    const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SumUp API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();

    // Extract hosted checkout URL from response
    const hostedCheckoutUrl = data.hosted_checkout_url;
    if (!hostedCheckoutUrl) {
      throw new Error('No hosted_checkout.url in SumUp response');
    }

    return {
      checkoutId: data.id,
      checkoutUrl: hostedCheckoutUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create SumUp checkout: ${error.message}`);
    }
    throw new Error('Failed to create SumUp checkout: Unknown error');
  }
}

interface CheckoutDetails {
  id: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  amount: number;
  currency: string;
  checkout_reference: string;
  description: string;
}

/**
 * Fetches checkout details from SumUp API to verify transaction
 */
export async function getCheckoutDetails(
  checkoutId: string,
): Promise<CheckoutDetails> {
  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) {
    throw new Error('SUMUP_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SumUp API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();

    if (!data) {
      throw new Error('No checkout data returned from SumUp API');
    }

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      checkout_reference: data.checkout_reference,
      description: data.description,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch checkout details: ${error.message}`);
    }
    throw new Error('Failed to fetch checkout details: Unknown error');
  }
}
