import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PaymentProvider as PrismaPaymentProvider } from '@prisma/client';
import { IPaymentProvider } from './payment-provider.interface';
import { ManualBankProvider } from './manual-bank.provider';
import { TelebirrProvider } from './telebirr.provider';
import { CbeBirrProvider } from './cbe-birr.provider';
import { ChapaProvider } from './chapa.provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<PrismaPaymentProvider, IPaymentProvider>();

  constructor(
    @Inject(ManualBankProvider)
    manualBank?: ManualBankProvider,
    @Inject(TelebirrProvider)
    telebirr?: TelebirrProvider,
    @Inject(CbeBirrProvider)
    cbeBirr?: CbeBirrProvider,
    @Inject(ChapaProvider)
    chapa?: ChapaProvider,
  ) {
    this.providers.set(PrismaPaymentProvider.MANUAL_BANK, manualBank || new ManualBankProvider());
    this.providers.set(PrismaPaymentProvider.TELEBIRR, telebirr || new TelebirrProvider());
    this.providers.set(PrismaPaymentProvider.CBE_BIRR, cbeBirr || new CbeBirrProvider());
    this.providers.set(PrismaPaymentProvider.CHAPA, chapa || new ChapaProvider());
  }

  getProvider(type: PrismaPaymentProvider): IPaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      // Fall back to manual bank provider for unsupported or offline providers
      return this.providers.get(PrismaPaymentProvider.MANUAL_BANK)!;
    }
    return provider;
  }

  resolveByParam(param: string): IPaymentProvider {
    const normalized = param?.trim().toUpperCase();
    if (normalized === 'CHAPA') return this.getProvider(PrismaPaymentProvider.CHAPA);
    if (normalized === 'TELEBIRR') return this.getProvider(PrismaPaymentProvider.TELEBIRR);
    if (normalized === 'CBE_BIRR' || normalized === 'CBE' || normalized === 'CBEBIRR')
      return this.getProvider(PrismaPaymentProvider.CBE_BIRR);
    if (normalized === 'MANUAL_BANK' || normalized === 'BANK')
      return this.getProvider(PrismaPaymentProvider.MANUAL_BANK);
    throw new NotFoundException(`Unknown or unsupported payment provider: "${param}"`);
  }
}
