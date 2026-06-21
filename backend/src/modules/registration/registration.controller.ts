import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RegistrationService } from './registration.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import { Idempotent, Public } from '../../common/decorators/index.js';
import {
  RegisterSoloSchema,
  RegisterTeamSchema,
  TeamInviteResponseSchema,
  CheckInSchema,
} from './dto/registration.dto.js';

@ApiTags('Registrations')
@Controller('registrations')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('solo')
  @Idempotent()
  @ApiOperation({ summary: 'Register as solo player' })
  @UsePipes(new ZodValidationPipe(RegisterSoloSchema))
  async registerSolo(
    @CurrentUser() user: RequestUser,
    @Body() body: { tournamentId: string },
  ) {
    return this.registrationService.registerSolo(user, body.tournamentId);
  }

  @Post('team')
  @Idempotent()
  @ApiOperation({ summary: 'Register as team' })
  @UsePipes(new ZodValidationPipe(RegisterTeamSchema))
  async registerTeam(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      tournamentId: string;
      memberPlayerIds: string[];
      teamName?: string;
    },
  ) {
    return this.registrationService.registerTeam(
      user,
      body.tournamentId,
      body.memberPlayerIds,
      body.teamName,
    );
  }

  @Post(':id/check-in')
  @Idempotent()
  @ApiOperation({ summary: 'Check in to tournament' })
  async checkIn(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.registrationService.checkIn(user, id);
  }

  @Post(':id/withdraw')
  @Idempotent()
  @ApiOperation({ summary: 'Withdraw from tournament' })
  async withdraw(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.registrationService.withdraw(user, id, body.reason);
  }

  @Post(':id/invite-response')
  @Idempotent()
  @ApiOperation({ summary: 'Respond to team invite' })
  @UsePipes(new ZodValidationPipe(TeamInviteResponseSchema))
  async respondToInvite(
    @CurrentUser() user: RequestUser,
    @Param('id') registrationId: string,
    @Body() body: { response: 'accepted' | 'declined' },
  ) {
    return this.registrationService.respondToInvite(
      user,
      registrationId,
      body.response,
    );
  }

  @Get('tournament/:tournamentId')
  @Public()
  @ApiOperation({ summary: 'List registrations for tournament' })
  async listByTournament(
    @Param('tournamentId') tournamentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registrationService.listByTournament(
      tournamentId,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }
}
