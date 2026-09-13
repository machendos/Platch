import { Injectable } from '@nestjs/common';
import { TimezoneChangeRepository } from './timezone.change.repository';
import { CreateTimezoneChangeDto } from './dto/create.timezone.change.dto';
import { UpdateTimezoneChangeDto } from './dto/update.timezone.change.dto';

@Injectable()
export class TimezoneChangeService {
  constructor(private timezoneChangeRepository: TimezoneChangeRepository) {}
  createTimezoneChange(create: CreateTimezoneChangeDto, userId: string) {
    return this.timezoneChangeRepository.createTimezoneChange({
      ianaTimezone: create.ianaTimezone,
      user: { connect: { id: userId } },
      cityLabel: create.cityLabel,
      changesAt: create.changesAt,
    });
  }

  updateTimezoneChange(update: UpdateTimezoneChangeDto) {
    return this.timezoneChangeRepository.updateTimezoneChange(
      { id: update.id },
      {
        ianaTimezone: update.ianaTimezone,
        cityLabel: update.cityLabel,
        changesAt: update.changesAt,
      },
    );
  }

  async deleteTimezoneChange(id: string) {
    await this.timezoneChangeRepository.deleteTimezoneChange({ id });
  }
}
