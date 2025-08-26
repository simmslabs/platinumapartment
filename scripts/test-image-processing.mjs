import { processAndStoreImage } from "../app/utils/image.server.js";

// Test base64 data (1x1 red pixel PNG)
const testBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

console.log("=== Testing Image Processing ===");

async function testImageProcessing() {
  try {
    console.log("Processing test image...");
    const result = await processAndStoreImage(testBase64, "test.png", "test");
    
    console.log("Result:", {
      success: result.success,
      hasImageUrl: !!result.imageUrl,
      imageUrlType: result.imageUrl ? 
        (result.imageUrl.startsWith('data:') ? 'base64' : 
         result.imageUrl.startsWith('http') ? 'url' : 'unknown') : 'none',
      imageUrlLength: result.imageUrl?.length,
      error: result.error,
      isR2: result.isR2
    });
    
    if (result.imageUrl) {
      console.log("Image URL preview:", result.imageUrl.substring(0, 100) + "...");
    }
  } catch (error) {
    console.error("Error processing image:", error);
  }
}

testImageProcessing();
