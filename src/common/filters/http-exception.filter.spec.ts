import { HttpExceptionFilter } from "./http-exception.filter";
import { ArgumentsHost, BadRequestException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
  });

  it("should be defined", () => {
    expect(filter).toBeDefined();
  });

  it("should format legacy validation errors correctly", () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockImplementation(() => ({ json: mockJson }));
    const mockGetResponse = jest
      .fn()
      .mockImplementation(() => ({ status: mockStatus }));
    const mockGetRequest = jest
      .fn()
      .mockReturnValue({ url: "/test", method: "POST", headers: {} });

    const mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;

    // Simulate what ValidationPipe throws currently (legacy)
    // "email must be an email" -> field: "email" (matched by ^(\w+)\s)
    const validationErrors = ["email must be an email"];
    const exception = new BadRequestException({ message: validationErrors });

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                field: "email",
                message: "email must be an email",
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it("should format new colon-separated validation errors correctly", () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockImplementation(() => ({ json: mockJson }));
    const mockGetResponse = jest
      .fn()
      .mockImplementation(() => ({ status: mockStatus }));
    const mockGetRequest = jest
      .fn()
      .mockReturnValue({ url: "/test", method: "POST", headers: {} });

    const mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;

    // Simulate new format we want to support
    const validationErrors = [
      "email: Invalid email format",
      "password: Password too short",
    ];
    const exception = new BadRequestException({ message: validationErrors });

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                field: "email",
                message: "email: Invalid email format",
              }),
              expect.objectContaining({
                field: "password",
                message: "password: Password too short",
              }),
            ]),
          }),
        }),
      }),
    );
  });
});
