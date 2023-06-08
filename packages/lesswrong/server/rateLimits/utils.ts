import uniq from "lodash/uniq"
import moment from "moment"
import { getDownvoteRatio } from "../../components/sunshineDashboard/UsersReviewInfoCard"
import Comments from "../../lib/collections/comments/collection"
import { getModeratorRateLimit, getTimeframeForRateLimit, userHasActiveModeratorActionOfType } from "../../lib/collections/moderatorActions/helpers"
import { RATE_LIMIT_THREE_COMMENTS_PER_POST_PER_WEEK } from "../../lib/collections/moderatorActions/schema"
import Posts from "../../lib/collections/posts/collection"
import UserRateLimits from "../../lib/collections/userRateLimits/collection"
import { forumSelect } from "../../lib/forumTypeUtils"
import { userIsAdmin, userIsMemberOf } from "../../lib/vulcan-users/permissions"
import VotesRepo, { RecentVoteInfo } from "../repos/VotesRepo"
import { autoCommentRateLimits, autoPostRateLimits } from "./constants"
import type { AutoRateLimit, RateLimitInfo, RecentKarmaInfo, StrictestCommentRateLimitInfoParams, TimeframeUnitType, UserRateLimit } from "./types"

function getMaxAutoLimitHours(rateLimits?: Array<AutoRateLimit>) {
  if (!rateLimits) return 0
  return Math.max(...rateLimits.map(({timeframeLength, timeframeUnit}) => {
    return moment.duration(timeframeLength, timeframeUnit).asHours()
  }))
}

function shouldIgnorePostRateLimit(user: DbUser) {
  return userIsAdmin(user) || userIsMemberOf(user, "sunshineRegiment") || userIsMemberOf(user, "canBypassPostRateLimit")
}

async function getModRateLimitHours(userId: string): Promise<number> {
  const moderatorRateLimit = await getModeratorRateLimit(userId)
  return moderatorRateLimit ? getTimeframeForRateLimit(moderatorRateLimit?.type) : 0
}

async function getModPostSpecificRateLimitHours(userId: string): Promise<number> {
  const hasPostSpecificRateLimit = await userHasActiveModeratorActionOfType(userId, RATE_LIMIT_THREE_COMMENTS_PER_POST_PER_WEEK)
  return hasPostSpecificRateLimit ? getTimeframeForRateLimit(RATE_LIMIT_THREE_COMMENTS_PER_POST_PER_WEEK) : 0
}

async function getPostsInTimeframe(user: DbUser, maxHours: number) {
  return await Posts.find({
    userId:user._id, 
    draft: false,
    postedAt: {$gte: moment().subtract(maxHours, 'hours').toDate()}
  }, {sort: {postedAt: -1}, projection: {postedAt: 1}}).fetch()
}

function getUserRateLimit<T extends DbUserRateLimit['type']>(userId: string, type: T) {
  return UserRateLimits.findOne({
    userId,
    type,
    $or: [{endedAt: null}, {endedAt: {$gt: new Date()}}]
  }, {
    sort: {
      createdAt: -1
    }
  }) as Promise<UserRateLimit<T> | null>;
}

function getUserRateLimitIntervalHours(userRateLimit: DbUserRateLimit | null): number {
  if (!userRateLimit) return 0;
  return moment.duration(userRateLimit.intervalLength, userRateLimit.intervalUnit).asHours();
}

function getNextAbleToSubmitDate(documents: Array<DbPost|DbComment>, timeframeUnit: TimeframeUnitType, timeframeLength: number, itemsPerTimeframe: number): Date|null {
  // make sure documents are sorted by descending date
  const sortedDocs = documents.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
  const docsInTimeframe = sortedDocs.filter(doc => doc.postedAt > moment().subtract(timeframeLength, timeframeUnit).toDate())
  const doc = docsInTimeframe[itemsPerTimeframe - 1]
  if (!doc) return null 
  return moment(doc.postedAt).add(timeframeLength, timeframeUnit).toDate()
}

function getModRateLimitInfo(documents: Array<DbPost|DbComment>, modRateLimitHours: number, itemsPerTimeframe: number): RateLimitInfo|null {
  if (modRateLimitHours <= 0) return null
  const nextEligible = getNextAbleToSubmitDate(documents, "hours", modRateLimitHours, itemsPerTimeframe)
  if (!nextEligible) return null
  return {
    nextEligible,
    rateLimitMessage: "A moderator has rate limited you.",
    rateLimitType: "moderator"
  }
}

function shouldRateLimitApply(user: DbUser, rateLimit: AutoRateLimit, recentKarmaInfo: RecentKarmaInfo): boolean {
  // rate limit conditions
  const { karmaThreshold, downvoteRatio, 
          recentKarmaThreshold, recentPostKarmaThreshold, recentCommentKarmaThreshold,
          downvoterCountThreshold, postDownvoterCountThreshold, commentDownvoterCountThreshold } = rateLimit

  // user's recent karma info
  const { recentKarma, recentPostKarma, recentCommentKarma, 
          downvoterCount, postDownvoterCount, commentDownvoterCount } = recentKarmaInfo

  // Karma is actually sometimes null, and numeric comparisons with null always return false (sometimes incorrectly)
  if ((karmaThreshold !== undefined) && (user.karma ?? 0) > karmaThreshold) return false 
  if ((downvoteRatio !== undefined) && getDownvoteRatio(user) < downvoteRatio) return false

  if ((recentKarmaThreshold !== undefined) && (recentKarma > recentKarmaThreshold)) return false
  if ((recentPostKarmaThreshold !== undefined) && (recentPostKarma > recentPostKarmaThreshold)) return false
  if ((recentCommentKarmaThreshold !== undefined) && (recentCommentKarma > recentCommentKarmaThreshold)) return false

  if ((downvoterCountThreshold !== undefined) && (downvoterCount > downvoterCountThreshold)) return false
  if ((postDownvoterCountThreshold !== undefined) && (postDownvoterCount > postDownvoterCountThreshold)) return false
  if ((commentDownvoterCountThreshold !== undefined) && (commentDownvoterCount > commentDownvoterCountThreshold)) return false
  return true
}

function getAutoRateLimitInfo(user: DbUser, rateLimit: AutoRateLimit,  documents: Array<DbPost|DbComment>, recentKarmaInfo: RecentKarmaInfo): RateLimitInfo|null {
  // rate limit effects
  const { timeframeUnit, timeframeLength, itemsPerTimeframe, rateLimitMessage, rateLimitType } = rateLimit 

  if (!shouldRateLimitApply(user, rateLimit, recentKarmaInfo)) return null

  const nextEligible = getNextAbleToSubmitDate(documents, timeframeUnit, timeframeLength, itemsPerTimeframe)
  if (!nextEligible) return null 
  return { nextEligible, rateLimitType, rateLimitMessage }
}

function getStrictestRateLimitInfo(rateLimits: Array<RateLimitInfo|null>): RateLimitInfo | null {
  const nonNullRateLimits = rateLimits.filter((rateLimit): rateLimit is RateLimitInfo => rateLimit !== null)
  const sortedRateLimits = nonNullRateLimits.sort((a, b) => b.nextEligible.getTime() - a.nextEligible.getTime());
  return sortedRateLimits[0] ?? null;
}

function getUserRateLimitInfo(userRateLimit: DbUserRateLimit|null, documents: Array<DbPost|DbComment>): RateLimitInfo|null {
  if (!userRateLimit) return null
  const nextEligible = getNextAbleToSubmitDate(documents, userRateLimit.intervalUnit, userRateLimit.intervalLength, userRateLimit.actionsPerInterval)
  if (!nextEligible) return null
  return {
    nextEligible,
    rateLimitType: "moderator",
    rateLimitMessage: "A moderator has rate limited you."
  }
}

async function getPostRateLimitInfos(user: DbUser, postsInTimeframe: Array<DbPost>, modRateLimitHours: number, userPostRateLimit: UserRateLimit<"allPosts">|null): Promise<Array<RateLimitInfo>> {
  // for each rate limit, get the next date that user could post  
  const userPostRateLimitInfo = getUserRateLimitInfo(userPostRateLimit, postsInTimeframe)

  const recentKarmaInfo = await getRecentKarmaInfo(user._id)
  const autoRatelimits = forumSelect(autoPostRateLimits)
  const autoRateLimitInfos = autoRatelimits?.map(
    rateLimit => getAutoRateLimitInfo(user, rateLimit, postsInTimeframe, recentKarmaInfo)
  ) ?? []

  // modRateLimitInfo is sort of deprecated, but we're still using it for at least a couple months
  const modRateLimitInfo = getModRateLimitInfo(postsInTimeframe, modRateLimitHours, 1)

  return [modRateLimitInfo, userPostRateLimitInfo, ...autoRateLimitInfos].filter((rateLimit): rateLimit is RateLimitInfo => rateLimit !== null)
}

async function getCommentsInTimeframe(userId: string, maxTimeframe: number) {
  const commentsInTimeframe = await Comments.find(
    { userId: userId, 
      postedAt: {$gte: moment().subtract(maxTimeframe, 'hours').toDate()}
    }, {
      sort: {postedAt: -1}, 
      projection: {postId: 1, postedAt: 1}
    }
  ).fetch()
  return commentsInTimeframe
}

/**
 * Checks if the user is exempt from commenting rate limits (optionally, for the given post).
 *
 * Admins and mods are always exempt.
 * If the post has "ignoreRateLimits" set, then all users are exempt.
 * On forums other than the EA Forum, the post author is always exempt on their own posts.
 */
async function shouldIgnoreCommentRateLimit(user: DbUser, postId: string | null): Promise<boolean> {
  if (userIsAdmin(user) || userIsMemberOf(user, "sunshineRegiment")) {
    return true;
  }
  if (postId) {
    const post = await Posts.findOne({_id: postId}, undefined, { userId: 1, ignoreRateLimits: 1 });
    if (post?.ignoreRateLimits) {
      return true;
    }
  }
  return false;
}

async function getUserIsAuthor(userId: string, postId: string|null): Promise<boolean> {
  if (!postId) return false
  const post = await Posts.findOne({_id:postId}, {projection:{userId:1, coauthorStatuses:1}})
  if (!post) return false
  const userIsNotPrimaryAuthor = post.userId !== userId
  const userIsNotCoauthor = !post.coauthorStatuses || post.coauthorStatuses.every(coauthorStatus => coauthorStatus.userId !== userId)
  return !(userIsNotPrimaryAuthor && userIsNotCoauthor)
}

function getModPostSpecificRateLimitInfo (comments: Array<DbComment>, modPostSpecificRateLimitHours: number, postId: string | null, userIsAuthor: boolean): RateLimitInfo|null {
  const eligibleForCommentOnSpecificPostRateLimit = (modPostSpecificRateLimitHours > 0) && !userIsAuthor;
  const commentsOnPost = comments.filter(comment => comment.postId === postId)

  return eligibleForCommentOnSpecificPostRateLimit ? getModRateLimitInfo(commentsOnPost, modPostSpecificRateLimitHours, 3) : null
}

async function getCommentsOnOthersPosts(comments: Array<DbComment>, userId: string) {
  const postIds = comments.map(comment => comment.postId)
  const postsNotAuthoredByCommenter = await Posts.find(
    { _id: {$in: postIds}, userId: {$ne: userId}}, {projection: {_id:1, coauthorStatuses:1}
  }).fetch()
  // right now, filtering out coauthors doesn't work (due to a bug in our query builder), so we're doing that manually
  const postsNotCoauthoredByCommenter = postsNotAuthoredByCommenter.filter(post => !post.coauthorStatuses || post.coauthorStatuses.every(coauthorStatus => coauthorStatus.userId !== userId))
  const postsNotAuthoredByCommenterIds = postsNotCoauthoredByCommenter.map(post => post._id)
  const commentsOnNonauthorPosts = comments.filter(comment => postsNotAuthoredByCommenterIds.includes(comment.postId))
  return commentsOnNonauthorPosts
}

async function getCommentRateLimitInfos({commentsInTimeframe, user, modRateLimitHours, modPostSpecificRateLimitHours, postId, userCommentRateLimit}: StrictestCommentRateLimitInfoParams): Promise<Array<RateLimitInfo>> {
  const userIsAuthor = await getUserIsAuthor(user._id, postId)
  const commentsOnOthersPostsInTimeframe =  await getCommentsOnOthersPosts(commentsInTimeframe, user._id)
  const modGeneralRateLimitInfo = getModRateLimitInfo(commentsOnOthersPostsInTimeframe, modRateLimitHours, 1)

  const modSpecificPostRateLimitInfo = getModPostSpecificRateLimitInfo(commentsOnOthersPostsInTimeframe, modPostSpecificRateLimitHours, postId, userIsAuthor)

  const userRateLimitInfo = userIsAuthor ? null : getUserRateLimitInfo(userCommentRateLimit, commentsOnOthersPostsInTimeframe)

  const autoRateLimits = forumSelect(autoCommentRateLimits)
  const filteredAutoRateLimits = autoRateLimits?.filter(rateLimit => {
    if (userIsAuthor) return rateLimit.appliesToOwnPosts
    return true 
  })

  const recentKarmaInfo = await getRecentKarmaInfo(user._id)
  const autoRateLimitInfos = filteredAutoRateLimits?.map(
    rateLimit => getAutoRateLimitInfo(user, rateLimit, commentsInTimeframe, recentKarmaInfo)
  ) ?? []
  return [modGeneralRateLimitInfo, modSpecificPostRateLimitInfo, userRateLimitInfo, ...autoRateLimitInfos].filter((rateLimit): rateLimit is RateLimitInfo => rateLimit !== null)
}

export async function rateLimitDateWhenUserNextAbleToPost(user: DbUser): Promise<RateLimitInfo|null> {
  // Admins and Sunshines aren't rate-limited
  if (shouldIgnorePostRateLimit(user)) return null;
  
  // does the user have a moderator-assigned rate limit?
  const [modRateLimitHours, userPostRateLimit] = await Promise.all([
    getModRateLimitHours(user._id),
    getUserRateLimit(user._id, 'allPosts')
  ]);

  // what's the longest rate limit timeframe being evaluated?
  const userPostRateLimitHours = getUserRateLimitIntervalHours(userPostRateLimit);
  const maxPostAutolimitHours = getMaxAutoLimitHours(forumSelect(autoPostRateLimits));
  const maxHours = Math.max(modRateLimitHours, userPostRateLimitHours, maxPostAutolimitHours);

  // fetch the posts from within the maxTimeframe
  const postsInTimeframe = await getPostsInTimeframe(user, maxHours);

  const rateLimitInfos = await getPostRateLimitInfos(user, postsInTimeframe, modRateLimitHours, userPostRateLimit);

  return getStrictestRateLimitInfo(rateLimitInfos)
}

export async function rateLimitDateWhenUserNextAbleToComment(user: DbUser, postId: string | null): Promise<RateLimitInfo|null> {
  const ignoreRateLimits = await shouldIgnoreCommentRateLimit(user, postId);
  if (ignoreRateLimits) return null;

  // does the user have a moderator-assigned rate limit?
  const [modRateLimitHours, modPostSpecificRateLimitHours, userCommentRateLimit] = await Promise.all([
    getModRateLimitHours(user._id),
    getModPostSpecificRateLimitHours(user._id),
    getUserRateLimit(user._id, 'allComments')
  ]);

  // what's the longest rate limit timeframe being evaluated?
  const maxCommentAutolimitHours = getMaxAutoLimitHours(forumSelect(autoCommentRateLimits))
  const maxHours = Math.max(modRateLimitHours, modPostSpecificRateLimitHours, maxCommentAutolimitHours);

  // fetch the comments from within the maxTimeframe
  const commentsInTimeframe = await getCommentsInTimeframe(user._id, maxHours);

  const rateLimitInfos = await getCommentRateLimitInfos({
    commentsInTimeframe, 
    user, 
    modRateLimitHours, 
    modPostSpecificRateLimitHours, 
    postId,
    userCommentRateLimit
  });

  return getStrictestRateLimitInfo(rateLimitInfos)
}

async function getVotesOnLatestDocuments (votes: RecentVoteInfo[], numItems=20): Promise<RecentVoteInfo[]> {
  // sort the votes via the date of the *postedAt* (joined from )
  const sortedVotes = votes.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
  
  const uniqueDocumentIds = uniq(sortedVotes.map((vote) => vote.documentId))
  const latestDocumentIds = new Set(uniqueDocumentIds.slice(0, numItems))

  // get all votes whose documentId is in the top 20 most recent documents
  return sortedVotes.filter((vote) => latestDocumentIds.has(vote.documentId))
}

export async function getRecentKarmaInfo (userId: string): Promise<RecentKarmaInfo> {
  const votesRepo = new VotesRepo()
  const allVotes = await votesRepo.getVotesOnRecentContent(userId)
  const top20documentVotes = await getVotesOnLatestDocuments(allVotes)

  // We filter out the user's self-upvotes here, rather than in the query, because
  // otherwise the getLatest20contentItems won't know about all the relevant posts and comments. 
  // i.e. if a user comments 20 times, and nobody upvotes them, we wouldn't know to include them in the sorted list
  const nonuserIDallVotes = allVotes.filter((vote: RecentVoteInfo) => vote.userId !== userId)
  const nonUserIdTop20DocVotes = top20documentVotes.filter((vote: RecentVoteInfo) => vote.userId !== userId)
  const postVotes = nonuserIDallVotes.filter(vote => vote.collectionName === "Posts")
  const commentVotes = nonuserIDallVotes.filter(vote => vote.collectionName === "Comments")

  const recentKarma = nonUserIdTop20DocVotes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  const recentPostKarma = postVotes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  const recentCommentKarma = commentVotes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  
  const downvoters = nonUserIdTop20DocVotes.filter((vote: RecentVoteInfo) => vote.power < 0).map((vote: RecentVoteInfo) => vote.userId)
  const downvoterCount = uniq(downvoters).length
  const commentDownvoters = commentVotes.filter((vote: RecentVoteInfo) => vote.power < 0).map((vote: RecentVoteInfo) => vote.userId)
  const commentDownvoterCount = uniq(commentDownvoters).length
  const postDownvotes = postVotes.filter((vote: RecentVoteInfo) => vote.power < 0).map((vote: RecentVoteInfo) => vote.userId)
  const postDownvoterCount = uniq(postDownvotes).length

  // NOTE: the following code is just console logs for sanity checking the above code.
  // I'm leaving it in for now until I'm more confident that the above code is correct.

  // const posts = groupBy(allVotes.filter(vote => vote.collectionName === "Posts"), (vote) => vote.documentId)

  // const comments = groupBy(allVotes.filter(vote => vote.collectionName === "Comments"), (vote) => vote.documentId)

  // const documents = groupBy(top20documentVotes, (vote) => vote.documentId)
  
  // console.log("posts", Object.keys(posts).length)
  // Object.values(posts).forEach((postVotes, i) => {
  //   const powerTotal = postVotes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  //   console.log(i, postVotes[0].documentId, postVotes[0].collectionName, powerTotal)
  // })
  // console.log("comments", Object.keys(posts).length)
  // Object.values(comments).forEach((votes, i) => {
  //   const powerTotal = votes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  //   console.log(i, votes[0].documentId, votes[0].collectionName, powerTotal)
  // })
  // console.log("all")
  // Object.values(documents).forEach((documentVotes, i) => {
  //   const powerTotal = documentVotes.reduce((sum: number, vote: RecentVoteInfo) => sum + vote.power, 0)
  //   console.log(i, documentVotes[0].documentId, documentVotes[0].collectionName, powerTotal)
  // })

  return { 
    recentKarma: recentKarma ?? 0, 
    recentPostKarma: recentPostKarma ?? 0,
    recentCommentKarma: recentCommentKarma ?? 0,
    downvoterCount: downvoterCount ?? 0, 
    postDownvoterCount: postDownvoterCount ?? 0,
    commentDownvoterCount: commentDownvoterCount ?? 0
  }
}
