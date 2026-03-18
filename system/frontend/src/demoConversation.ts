/**
 * Pre-scripted demo conversation for GSDSEF presentation.
 * Demonstrates the full pedagogical arc: omission -> commission -> ambiguity -> discovery.
 * Load with ?demo=true URL parameter.
 */

export interface DemoMessage {
  sender: string;
  text: string;
  pairs?: Record<string, Record<string, any>>;
  messageType?: string;
  missingDataTypes?: string[];
  discoveredRequirements?: string[];
}

export const demoConversation: DemoMessage[] = [
  // --- Phase 1: Initial scenario (omission) ---
  {
    sender: 'assistant',
    text: `Hi! I'm Alex, a CS1 student building a rideshare matching system. I've written code that matches riders to the nearest available vehicle. Can you help me test it?\n\nHere's a scenario I set up: one rider at (3, 5) and two vehicles at (4, 5) and (10, 12). My system matches the rider to the vehicle at (4, 5) since it's closest. Does that seem right?`,
    pairs: {
      rider_1: { pickup_location: '(3, 5)', destination: '(15, 15)' },
      vehicle_1: { car_cur_location: '(4, 5)', status: 'available' },
      vehicle_2: { car_cur_location: '(10, 12)', status: 'available' },
    },
    messageType: 'test_scenario',
    missingDataTypes: [],
    discoveredRequirements: [],
  },

  // --- User probes for omission: what about rider timing? ---
  {
    sender: 'user',
    text: `What happens if the rider requested the ride 10 minutes ago and vehicle_1 just became available? Does your system consider how long the rider has been waiting?`,
  },

  // --- Phase 2: Alex realizes omission ---
  {
    sender: 'assistant',
    text: `Oh, I didn't think about that. My code only looks at distance — it doesn't track when a rider requested their ride. So a rider who's been waiting 10 minutes gets treated the same as someone who just requested.\n\nI guess I'd need a timestamp for when each ride was requested? What data should I be storing?`,
    pairs: {
      rider_1: { pickup_location: '(3, 5)', destination: '(15, 15)', request_time: '?' },
      vehicle_1: { car_cur_location: '(4, 5)', status: 'available' },
      vehicle_2: { car_cur_location: '(10, 12)', status: 'available' },
    },
    messageType: 'probe',
    missingDataTypes: ['request_timestamp', 'wait_time_priority'],
    discoveredRequirements: [],
  },

  // --- User guides toward requirement specification ---
  {
    sender: 'user',
    text: `Right — you need a request_timestamp for each rider. But here's a harder question: if two riders are both waiting and only one vehicle is free, how do you decide who gets it? Closest rider, or the one who's waited longest?`,
  },

  // --- Phase 3: Commission error (flawed logic) ---
  {
    sender: 'assistant',
    text: `I updated my code to always prioritize the rider who waited longest. Let me test: rider_1 requested at t=0 at (3, 5), rider_2 requested at t=2 at (4, 4). One vehicle at (4, 5).\n\nMy system assigns vehicle_1 to rider_1 because they waited longer. But rider_2 is literally one block away from the vehicle...`,
    pairs: {
      rider_1: { pickup_location: '(3, 5)', destination: '(15, 15)', request_time: 't=0' },
      rider_2: { pickup_location: '(4, 4)', destination: '(8, 8)', request_time: 't=2' },
      vehicle_1: { car_cur_location: '(4, 5)', status: 'available' },
    },
    messageType: 'test_scenario',
    missingDataTypes: [],
    discoveredRequirements: [],
  },

  // --- User highlights the commission error ---
  {
    sender: 'user',
    text: `You found a commission error — your new rule always picks wait time over distance, which can send a vehicle far away when there's a rider right next to it. What if you combined both factors instead of picking just one?`,
  },

  // --- Phase 4: Ambiguity ---
  {
    sender: 'assistant',
    text: `So I need to balance distance AND wait time. But how do I weigh them? If rider_1 waited 10 minutes but is 15 blocks away, and rider_2 waited 2 minutes but is 1 block away... there's no obviously correct answer.\n\nAlso, I just realized — what about accessibility? If rider_1 needs a wheelchair-accessible vehicle, that should matter more than distance or wait time.`,
    pairs: {
      rider_1: { pickup_location: '(3, 5)', destination: '(15, 15)', request_time: 't=0', accessibility: '?' },
      rider_2: { pickup_location: '(4, 4)', destination: '(8, 8)', request_time: 't=2', accessibility: '?' },
      vehicle_1: { car_cur_location: '(4, 5)', status: 'available', accessible: '?' },
    },
    messageType: 'probe',
    missingDataTypes: ['accessibility_flag', 'matching_weight_formula'],
    discoveredRequirements: [],
  },

  // --- User helps resolve ambiguity into concrete requirements ---
  {
    sender: 'user',
    text: `Now you're thinking about requirements properly. You've found three things your system needs: time-based priority, distance-based efficiency, and accessibility constraints. Can you write out what the matching rule should actually be?`,
  },

  // --- Phase 5: Discovery ---
  {
    sender: 'assistant',
    text: `OK, here's what I think the matching requirements are:\n\n1. Accessibility is a hard constraint — if a rider needs an accessible vehicle, only match them with one that has that capability.\n2. Among valid matches, use a weighted score: score = (0.6 × normalized_distance) + (0.4 × normalized_wait_time).\n3. If a rider has waited more than 10 minutes, boost their priority regardless of distance.\n\nThese came from the test cases we wrote — I wouldn't have found the accessibility issue without testing edge cases.`,
    pairs: {
      rider_1: { pickup_location: '(3, 5)', destination: '(15, 15)', request_time: 't=0', needs_accessible: true },
      rider_2: { pickup_location: '(4, 4)', destination: '(8, 8)', request_time: 't=2', needs_accessible: false },
      vehicle_1: { car_cur_location: '(4, 5)', status: 'available', is_accessible: true },
    },
    messageType: 'discovery',
    missingDataTypes: [],
    discoveredRequirements: [
      'Accessibility is a hard constraint: riders needing accessible vehicles can only match with capable vehicles',
      'Matching score combines distance (60%) and wait time (40%)',
      'Riders waiting >10 minutes receive priority boost regardless of distance',
      'Each rider must have a request_timestamp field',
      'Each vehicle must have an is_accessible boolean field',
    ],
  },
];
