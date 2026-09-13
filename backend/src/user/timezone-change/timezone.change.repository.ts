import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma-client';
import { BaseRepository } from '../../system/database/base-repositoty.service';

@Injectable()
export class TimezoneChangeRepository extends BaseRepository {
  getUserTimezoneChanges(where: Prisma.TimezoneChangeWhereInput) {
    return this.db.timezoneChange.findMany({
      where: where,
      orderBy: [{ changesAt: 'asc' }],
    });
  }

  createTimezoneChange(data: Prisma.TimezoneChangeCreateInput) {
    return this.db.timezoneChange.create({ data });
  }

  updateTimezoneChange(
    where: Prisma.TimezoneChangeWhereUniqueInput,
    data: Prisma.TimezoneChangeUpdateInput,
  ) {
    return this.db.timezoneChange.update({ where, data });
  }

  deleteTimezoneChange(where: Prisma.TimezoneChangeWhereUniqueInput) {
    return this.db.timezoneChange.delete({ where });
  }
}
