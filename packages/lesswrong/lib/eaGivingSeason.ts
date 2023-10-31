export const eaGivingSeason23ElectionName = "givingSeason23";

export const donationElectionLink = "#"; // TODO
export const setupFundraiserLink = "#"; // TODO
export const postsAboutElectionLink = "/topics/donation-election-2023";

export const votingOpensDate = new Date("2023-12-01");

export const donationElectionTagId = "EsNWGoFbs4MrqQ4G7";
export const effectiveGivingTagId = "L6NqHZkLc4xZ7YtDr";

type TimelinePoint = {
  date: Date,
  description: string,
}

type TimelineSpan = {
  start: Date,
  end: Date,
  description: string,
  hideDates?: boolean,
  hatched?: boolean,
}

export type TimelineSpec = {
  start: Date,
  end: Date,
  points: TimelinePoint[],
  spans: TimelineSpan[],
  divisionToPercent?: (division: number, divisions: number) => number,
}

export const timelineSpec: TimelineSpec = {
  start: new Date("2023-11-01"),
  end: new Date("2023-12-31"),
  points: [
    {date: new Date("2023-11-01"), description: "Election Fund opens"},
    {date: votingOpensDate, description: "Voting starts"},
    {date: new Date("2023-12-15"), description: "Voting ends"},
    {date: new Date("2023-12-31"), description: ""},
  ],
  spans: [
    {
      start: new Date("2023-11-07"),
      end: new Date("2023-11-14"),
      description: "Effective giving spotlight",
    },
    {
      start: new Date("2023-11-14"),
      end: new Date("2023-11-21"),
      description: "Marginal Funding Week",
    },
    {
      start: new Date("2023-11-21"),
      end: new Date("2023-11-28"),
      description: "Estimating cost-effectiveness",
    },
    {
      start: new Date("2023-12-01"),
      end: new Date("2023-12-15"),
      description: "Vote in the Election",
      hideDates: true,
      hatched: true,
    },
  ],
  // We have a lot of events in November and few in December. This function
  // allows us to space out Novemeber to use most of the timeline and only give
  // what's left to December. A point `inputSplit` along the timeline will be
  // linearly mapped to `outputSplit`, with points after `inputSplit` being
  // squeezed linearly into the remaining space.
  // This could almost certainly be simplified, but it's too late in the day
  // for algebra.
  divisionToPercent: (division: number, divisions: number) => {
    const inputSplit = 0.5;
    const outputSplit = 0.65;
    const multiplier = (100 / inputSplit) * outputSplit;
    const halfWay = divisions * inputSplit;
    if (division < halfWay) {
      return (division / divisions) * multiplier;
    } else {
      const multiplier2 = (100 / inputSplit) * (1 - outputSplit);
      return ((halfWay / divisions) * multiplier) +
        (((division - halfWay) / divisions) * multiplier2);
    }
  },
};
