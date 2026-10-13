export interface AppConfig {
  nodeEnv: string;
  port: number;
  appBaseUrl: string;
  tenantBaseDomain: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  cookie: {
    secret: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  cors: {
    allowedOrigins: string[];
  };
  throttler: {
    ttl: number;
    limit: number;
    authLimit: number;
  };
  payments: {
    telebirr: {
      appId: string;
      appKey: string;
      shortCode: string;
      publicKey: string;
      privateKey: string;
      notifyUrl: string;
      apiUrl: string;
    };
    cbeBirr: {
      merchantCode: string;
      apiKey: string;
      secretKey: string;
      notifyUrl: string;
      apiUrl: string;
    };
    chapa: {
      secretKey: string;
      publicKey: string;
      webhookSecret: string;
      apiUrl: string;
    };
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  tenantBaseDomain: process.env.TENANT_BASE_DOMAIN || 'waanofii.local',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me_immediately_32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || 'dev_insecure_cookie_secret_change_me_immediately',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
  cors: {
    allowedOrigins: Array.from(
      new Set([
        ...(process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
        ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL.trim()] : []),
        ...(process.env.NODE_ENV !== 'production'
          ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173']
          : []),
      ]),
    ),
  },
  throttler: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '60', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT || '10', 10),
  },
  payments: {
    telebirr: {
      appId: process.env.TELEBIRR_APP_ID || '',
      appKey: process.env.TELEBIRR_APP_KEY || '',
      shortCode: process.env.TELEBIRR_SHORT_CODE || '',
      publicKey: process.env.TELEBIRR_PUBLIC_KEY || '',
      privateKey: process.env.TELEBIRR_PRIVATE_KEY || '',
      notifyUrl: process.env.TELEBIRR_NOTIFY_URL || '',
      apiUrl: process.env.TELEBIRR_API_URL || 'https://app.telebirr.et:8443/epay/api/createOrder',
    },
    cbeBirr: {
      merchantCode: process.env.CBE_BIRR_MERCHANT_CODE || '',
      apiKey: process.env.CBE_BIRR_API_KEY || '',
      secretKey: process.env.CBE_BIRR_SECRET_KEY || '',
      notifyUrl: process.env.CBE_BIRR_NOTIFY_URL || '',
      apiUrl: process.env.CBE_BIRR_API_URL || '',
    },
    chapa: {
      secretKey: process.env.CHAPA_SECRET_KEY || '',
      publicKey: process.env.CHAPA_PUBLIC_KEY || '',
      webhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',
      apiUrl: process.env.CHAPA_API_URL || 'https://api.chapa.co/v1',
    },
  },
});
