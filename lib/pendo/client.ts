import { cleanProperties, type TrackEventName, type TrackProperties } from "./events";

/** The part of the browser agent the app uses. */
interface PendoAgent {
  track: (event: string, properties?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    pendo?: PendoAgent;
  }
}

export const pendo = {
  /**
   * Records a track event for whoever is on the page; the agent attributes it to the signed-in
   * user or the anonymous visitor. Does nothing when the agent is not on the page.
   */
  track(event: TrackEventName, properties: TrackProperties = {}): void {
    if (typeof window === "undefined") return;
    try {
      window.pendo?.track(event, cleanProperties(properties));
    } catch (error) {
      console.error(`Could not record ${event}`, error);
    }
  },
};
