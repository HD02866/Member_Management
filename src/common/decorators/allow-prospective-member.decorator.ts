import { SetMetadata } from '@nestjs/common';

export const ALLOW_PROSPECTIVE_MEMBER_KEY = 'allow_prospective_member';
export const AllowProspectiveMember = () => SetMetadata(ALLOW_PROSPECTIVE_MEMBER_KEY, true);
