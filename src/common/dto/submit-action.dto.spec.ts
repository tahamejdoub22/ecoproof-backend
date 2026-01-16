import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SubmitActionDto } from "./submit-action.dto";
import { MaterialType } from "../../entities/recycling-point.entity";

describe("SubmitActionDto", () => {
  it("should pass validation with valid data", async () => {
    const data = {
      recyclingPointId: "550e8400-e29b-41d4-a716-446655440000",
      objectType: MaterialType.PLASTIC,
      confidence: 0.9,
      boundingBoxAreaRatio: 0.5,
      frameCountDetected: 4,
      motionScore: 0.5,
      imageHash: "somehash",
      perceptualHash: "somephash",
      frameMetadata: [],
      imageMetadata: {
        width: 1920,
        height: 1080,
        format: "jpeg",
        capturedAt: Date.now(),
      },
      gpsLat: 40.7128,
      gpsLng: -74.006,
      gpsAccuracy: 10,
      capturedAt: Date.now(),
      idempotencyKey: "somekey",
    };
    const dto = plainToInstance(SubmitActionDto, data);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation with invalid GPS", async () => {
    const data = {
      recyclingPointId: "550e8400-e29b-41d4-a716-446655440000",
      objectType: MaterialType.PLASTIC,
      confidence: 0.9,
      boundingBoxAreaRatio: 0.5,
      frameCountDetected: 4,
      motionScore: 0.5,
      imageHash: "somehash",
      perceptualHash: "somephash",
      frameMetadata: [],
      imageMetadata: {
        width: 1920,
        height: 1080,
        format: "jpeg",
        capturedAt: Date.now(),
      },
      gpsLat: 100, // Invalid
      gpsLng: -200, // Invalid
      gpsAccuracy: 10,
      capturedAt: Date.now(),
      idempotencyKey: "somekey",
    };
    const dto = plainToInstance(SubmitActionDto, data);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const latError = errors.find((e) => e.property === "gpsLat");
    expect(latError.constraints.max).toBe(
      "Latitude must be between -90 and 90 degrees",
    );

    const lngError = errors.find((e) => e.property === "gpsLng");
    expect(lngError.constraints.min).toBe(
      "Longitude must be between -180 and 180 degrees",
    );
  });

  it("should fail validation with missing required fields", async () => {
    const data = {
      // missing recyclingPointId, imageHash, perceptualHash, idempotencyKey
      objectType: MaterialType.PLASTIC,
      confidence: 0.9,
      boundingBoxAreaRatio: 0.5,
      frameCountDetected: 4,
      motionScore: 0.5,
      frameMetadata: [],
      imageMetadata: {
        width: 1920,
        height: 1080,
        format: "jpeg",
        capturedAt: Date.now(),
      },
      gpsLat: 40.7128,
      gpsLng: -74.006,
      gpsAccuracy: 10,
      capturedAt: Date.now(),
    };
    const dto = plainToInstance(SubmitActionDto, data);
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === "recyclingPointId")).toBeDefined();
    expect(errors.find((e) => e.property === "imageHash")).toBeDefined();
    expect(errors.find((e) => e.property === "perceptualHash")).toBeDefined();
    expect(errors.find((e) => e.property === "idempotencyKey")).toBeDefined();
  });
});
