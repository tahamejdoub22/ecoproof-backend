import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("App")
@Controller()
export class AppController {
  @Get()
  @ApiOperation({
    summary: "Welcome endpoint",
    description: "Returns API information and status",
  })
  @ApiResponse({ status: 200, description: "Welcome message" })
  getHello() {
    return {
      name: "Ecoproof API",
      version: "1.0.0",
      description: "Smart Recycling Verification Backend",
      documentation: "/api/docs",
      health: "/api/v1/health",
      status: "running",
    };
  }
}
