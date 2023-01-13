import {PingbackDocument, RouterLocation} from './vulcan-lib'
import {Posts} from './collections/posts'
import {Users} from './collections/users/collection'

export async function getPostPingbackById(parsedUrl: RouterLocation, postId: string | null): Promise<PingbackDocument | null> {
  if (!postId)
    return null

  // If the URL contains a hash, it leads to either a comment, a landmark within
  // the post, or a builtin ID.
  // TODO: In the case of a comment, we should generate a comment-specific
  // pingback in addition to the pingback to the post the comment is on.
  // TODO: In the case of a landmark, we want to customize the hover preview to
  // reflect where in the post the link was to.
  return ({collectionName: 'Posts', documentId: postId})
}

export async function getPostPingbackByLegacyId(parsedUrl: RouterLocation, legacyId: string) {
  const parsedId = parseInt(legacyId, 36)
  const post = await Posts.findOne({'legacyId': parsedId.toString()})
  if (!post) return null
  return await getPostPingbackById(parsedUrl, post._id)
}

export async function getPostPingbackBySlug(parsedUrl: RouterLocation, slug: string) {
  const post = await Posts.findOne({slug: slug})
  if (!post) return null
  return await getPostPingbackById(parsedUrl, post._id)
}

export async function getUserPingbackBySlug(parsedUrl: RouterLocation): Promise<PingbackDocument | null> {
  const slug = parsedUrl.params.slug
  // TODO right now this is a convention sheared with `mentionConfig` find a place I could put it to embody it structurally (shared code)
  const hasMentionParam = parsedUrl.query.mention === 'user'
  
  if (!hasMentionParam) return null
  
  const user = await Users.findOne({slug: slug})
  if (!user) return null
 
  return ({collectionName: 'Users', documentId: user._id})
}
