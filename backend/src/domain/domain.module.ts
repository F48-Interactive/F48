import { Global, Module } from '@nestjs/common';
import { AccessAuthorityService } from './access-authority.service.js';
import { MatchAuthorityService } from './match-authority.service.js';
import { MediaAuthorityService } from './media-authority.service.js';
import { RegistrationAuthorityService } from './registration-authority.service.js';
import { RoomCredentialAuthorityService } from './room-credential-authority.service.js';
import { ScoringAuthorityService } from './scoring-authority.service.js';
import { TournamentAuthorityService } from './tournament-authority.service.js';
import { DisputeAuthorityService } from './dispute-authority.service.js';

@Global()
@Module({
  providers: [
    AccessAuthorityService,
    DisputeAuthorityService,
    MatchAuthorityService,
    MediaAuthorityService,
    RegistrationAuthorityService,
    RoomCredentialAuthorityService,
    ScoringAuthorityService,
    TournamentAuthorityService,
  ],
  exports: [
    AccessAuthorityService,
    DisputeAuthorityService,
    MatchAuthorityService,
    MediaAuthorityService,
    RegistrationAuthorityService,
    RoomCredentialAuthorityService,
    ScoringAuthorityService,
    TournamentAuthorityService,
  ],
})
export class DomainModule {}
