/**
 * BannerService — Hero carousel banner management.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get active banners for the homepage carousel. */
  async getActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
        ],
      },
      orderBy: { priority: 'desc' },
      take: 10,
    });
  }

  /** Admin: create banner. */
  async create(data: {
    title: string; subtitle?: string; imageAssetId: string;
    linkType: string; linkId?: string; linkUrl?: string;
    priority?: number; startsAt?: string; endsAt?: string;
  }) {
    return this.prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        imageAssetId: data.imageAssetId,
        linkType: data.linkType as any,
        linkId: data.linkId,
        linkUrl: data.linkUrl,
        priority: data.priority ?? 0,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  }

  /** Admin: update banner. */
  async update(bannerId: string, data: Record<string, unknown>) {
    const banner = await this.prisma.banner.findUnique({ where: { id: bannerId } });
    if (!banner) throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Banner not found.');
    return this.prisma.banner.update({ where: { id: bannerId }, data });
  }

  /** Admin: delete banner. */
  async delete(bannerId: string) {
    await this.prisma.banner.delete({ where: { id: bannerId } });
  }
}
