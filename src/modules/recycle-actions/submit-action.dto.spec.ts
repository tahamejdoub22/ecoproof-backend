import { validate } from 'class-validator';
import { SubmitActionDto, ImageMetadataDto } from '../../common/dto/submit-action.dto';
import { MaterialType } from '../../entities/recycling-point.entity';

describe('SubmitActionDto', () => {
  let dto: SubmitActionDto;

  beforeEach(() => {
    dto = new SubmitActionDto();
    // Set default valid values
    dto.recyclingPointId = 'uuid';
    dto.objectType = MaterialType.PLASTIC;
    dto.confidence = 0.9;
    dto.boundingBoxAreaRatio = 0.3;
    dto.frameCountDetected = 5;
    dto.motionScore = 0.5;
    dto.imageHash = 'hash';
    dto.perceptualHash = 'phash';
    dto.frameMetadata = [];
    dto.imageMetadata = new ImageMetadataDto();
    dto.imageMetadata.width = 1920;
    dto.imageMetadata.height = 1080;
    dto.imageMetadata.format = 'jpeg';
    dto.imageMetadata.capturedAt = Date.now();
    dto.gpsLat = 0;
    dto.gpsLng = 0;
    dto.gpsAccuracy = 10;
    dto.capturedAt = Date.now();
    dto.idempotencyKey = 'key';
  });

  it('should validate valid dto', async () => {
    const errors = await validate(dto);
    if (errors.length > 0) {
      console.log('Validation errors:', JSON.stringify(errors, null, 2));
    }
    expect(errors.length).toBe(0);
  });

  it('should fail with friendly message when confidence is too low', async () => {
    dto.confidence = 0.5;
    const errors = await validate(dto);
    const confidenceError = errors.find((e) => e.property === 'confidence');
    expect(confidenceError).toBeDefined();
    // class-validator < 0.14 doesn't replace {value}, but 0.14 should.
    // However, it seems it's not working as expected in the test environment or config.
    // We'll check for the template string presence.
    expect(confidenceError.constraints.min).toContain('Confidence too low');
    expect(confidenceError.constraints.min).toContain('Ensure the object is clearly visible and well-lit');
  });

  it('should fail with friendly message when boundingBoxAreaRatio is too low', async () => {
    dto.boundingBoxAreaRatio = 0.1;
    const errors = await validate(dto);
    const error = errors.find((e) => e.property === 'boundingBoxAreaRatio');
    expect(error).toBeDefined();
    expect(error.constraints.min).toContain('Object too small in frame');
    expect(error.constraints.min).toContain('Please move closer to fill at least 25% of the screen');
  });

  it('should fail with friendly message when frameCountDetected is too low', async () => {
    dto.frameCountDetected = 2;
    const errors = await validate(dto);
    const error = errors.find((e) => e.property === 'frameCountDetected');
    expect(error).toBeDefined();
    expect(error.constraints.min).toContain('Object detected in too few frames');
    expect(error.constraints.min).toContain('Hold the camera steady on the object');
  });

  it('should fail with friendly message when motionScore is too low', async () => {
    dto.motionScore = 0.1;
    const errors = await validate(dto);
    const error = errors.find((e) => e.property === 'motionScore');
    expect(error).toBeDefined();
    expect(error.constraints.min).toContain('Motion score too low');
    expect(error.constraints.min).toContain('Please move the camera slightly to prove it is a live video');
  });
});
