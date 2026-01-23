import { validate } from 'class-validator';
import { FilterDto, SortOrder } from './filter.dto';
import { RecyclingPointFilterDto } from './recycling-point-filter.dto';
import { MaterialType } from '../../entities/recycling-point.entity';

describe('Filter DTOs', () => {
  describe('FilterDto', () => {
    it('should pass with valid data', async () => {
      const dto = new FilterDto();
      dto.page = 1;
      dto.limit = 10;
      dto.sortBy = 'createdAt';
      dto.sortOrder = SortOrder.DESC;
      dto.fromDate = '2023-01-01T00:00:00Z';
      dto.toDate = '2023-12-31T23:59:59Z';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate sortOrder enum', async () => {
      const dto = new FilterDto();
      // @ts-expect-error - Testing invalid enum
      dto.sortOrder = 'INVALID';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });

  describe('RecyclingPointFilterDto', () => {
    it('should validate materialType enum', async () => {
      const dto = new RecyclingPointFilterDto();
      dto.materialType = MaterialType.PLASTIC;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
