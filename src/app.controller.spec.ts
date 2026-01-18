import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return welcome message", () => {
      expect(appController.getHello()).toEqual({
        name: "Ecoproof API",
        version: "1.0.0",
        description: "Smart Recycling Verification Backend",
        documentation: "/api/docs",
        health: "/api/v1/health",
        status: "running",
      });
    });
  });
});
