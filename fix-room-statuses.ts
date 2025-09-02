import { updateAllRoomStatuses } from './app/utils/room-status.server';

async function fixRoomStatuses() {
  console.log("🏠 Starting room status fix...");
  
  try {
    await updateAllRoomStatuses();
    console.log("✅ All room statuses have been updated successfully!");
  } catch (error) {
    console.error("❌ Error updating room statuses:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixRoomStatuses();
