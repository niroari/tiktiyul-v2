import { TripMetadataForm } from "./trip-metadata-form";
import { WhatsappAssistantCard } from "./whatsapp-assistant-card";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">פרטי הטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            מידע בסיסי — ישמש בכל הנספחים
          </p>
        </div>
        <TripMetadataForm />
      </div>

      <div className="border-t pt-8">
        <WhatsappAssistantCard />
      </div>
    </div>
  );
}
