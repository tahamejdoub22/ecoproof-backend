import { validate } from "class-validator";
import { SubmitActionDto } from "./submit-action.dto";
import { MaterialType } from "../../entities/recycling-point.entity";

describe("SubmitActionDto Validation", () => {
  it("should fail with custom message if recyclingPointId is not a string", async () => {
    const dto = new SubmitActionDto();
    // @ts-expect-error Testing invalid type
    dto.recyclingPointId = 123;

    // Fill other required fields to isolate the error
    dto.objectType = MaterialType.PLASTIC;
    dto.confidence = 0.9;
    dto.boundingBoxAreaRatio = 0.5;
    dto.frameCountDetected = 5;
    dto.motionScore = 0.5;
    dto.imageHash = "hash";
    dto.perceptualHash = "phash";
    dto.gpsLat = 0;
    dto.gpsLng = 0;
    dto.gpsAccuracy = 10;
    dto.capturedAt = Date.now();
    dto.idempotencyKey = "key";
    dto.frameMetadata = [];
    // @ts-expect-error Testing invalid type
    dto.imageMetadata = {};

    const errors = await validate(dto);
    const error = errors.find((e) => e.property === "recyclingPointId");
    expect(error).toBeDefined();
    expect(error?.constraints?.isString).toBe(
      "Recycling point ID must be a valid string",
    );
  });

  it("should fail with custom message if objectType is invalid", async () => {
    const dto = new SubmitActionDto();
    dto.recyclingPointId = "uuid";
    // @ts-expect-error Testing invalid type
    dto.objectType = "INVALID_TYPE";

    const errors = await validate(dto);
    const error = errors.find((e) => e.property === "objectType");
    expect(error).toBeDefined();
    expect(error?.constraints?.isEnum).toBe(
      "Invalid material type. Please scan a supported material.",
    );
  });

  it("should fail with custom message if imageHash is not a string", async () => {
    const dto = new SubmitActionDto();
    // @ts-expect-error Testing invalid type
    dto.imageHash = 123;

    const errors = await validate(dto);
    const error = errors.find((e) => e.property === "imageHash");
    expect(error).toBeDefined();
    expect(error?.constraints?.isString).toBe("Image hash must be provided");
  });

  it("should fail with custom message if perceptualHash is not a string", async () => {
    const dto = new SubmitActionDto();
    // @ts-expect-error Testing invalid type
    dto.perceptualHash = 123;

    const errors = await validate(dto);
    const error = errors.find((e) => e.property === "perceptualHash");
    expect(error).toBeDefined();
    expect(error?.constraints?.isString).toBe(
      "Perceptual hash must be provided",
    );
  });
});
