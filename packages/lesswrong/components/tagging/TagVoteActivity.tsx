import React from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { Votes } from '../../lib/collections/votes';
import { useMulti } from '../../lib/crud/withMulti';
import { useCurrentUser } from '../common/withUser';
import { Posts } from '../../lib/collections/posts';
import { Link } from '../../lib/reactRouterWrapper';
import { useVote } from '../votes/withVote';

const styles = (theme: ThemeType): JssStyles => ({
  voteRow: {
  },
  headerCell: {
    fontWeight: "bold"
  },
  votingCell: {
    textAlign: "center",
    fontSize: '1.4rem'
  },
  voteButtons: {
    width: 50
  },
  tagCell: {
    width: 200,
    textAlign: "right"
  },
  score: {
    fontSize: '1.2rem',
    position: "relative",
    bottom: -1,
    margin: 5
  }
})

const TagVoteActivityRow = ({vote, classes}: {
  vote: TagVotingActivity,
  classes: ClassesType
}) => {
  const { FormatDate, VoteButton, FooterTag } = Components;
  const voteProps = useVote(vote.tagRel, "TagRels")
  return (
    <tr key={vote._id} className={classes.voteRow}>
      <td>{vote.userId?.slice(7,10)}</td>
      <td className={classes.tagCell}><FooterTag tag={vote.tagRel?.tag} tagRel={vote.tagRel} hideScore /></td>
      <td> <Link to={vote.tagRel?.post && Posts.getPageUrl(vote.tagRel.post)}> {vote.tagRel?.post?.title} </Link> </td>
      <td>{vote.power} {vote.isUnvote && <span title="Unvote">(unv.)</span>}</td>
      <td><FormatDate date={vote.votedAt}/></td>
      <td className={classes.votingCell}>
        <div className={classes.voteButtons}>
          <VoteButton
            orientation="left"
            color="error"
            voteType="Downvote"
            {...voteProps}
          />
          <span className={classes.score}>
            {voteProps.baseScore}
          </span>
          <VoteButton
            orientation="right"
            color="secondary"
            voteType="Upvote"
            {...voteProps}
          />
        </div>
      </td>
    </tr>
  );
}

const TagVoteActivity = ({classes}: {
  classes: ClassesType,
}) => {
  const { SingleColumnSection, Error404, LoadMore } = Components
  const { results: votes, loadMoreProps } = useMulti({
    terms: {view:"tagVotes"},
    collection: Votes,
    fragmentName: 'TagVotingActivity',
    limit: 200,
    ssr: true
  })

  const currentUser = useCurrentUser();

  if (!currentUser?.isAdmin) { return <Error404/> }

  return <SingleColumnSection>
    <table>
      <tbody>
        <tr className={classes.headerRow}>
          <td className={classes.headerCell}> User </td>
          <td className={classes.headerCell}> Tag </td>
          <td className={classes.headerCell}> Post Title </td>
          <td className={classes.headerCell}> Pow </td>
          <td className={classes.headerCell}> When </td>
          <td className={classes.headerCell}> Vote </td>
        </tr>
        {votes?.map(vote => <TagVoteActivityRow key={vote._id} vote={vote} classes={classes}/>)}
      </tbody>
    </table>
    <LoadMore {...loadMoreProps} />
  </SingleColumnSection>
}


const TagVoteActivityComponent = registerComponent("TagVoteActivity", TagVoteActivity, {styles});

declare global {
  interface ComponentTypes {
    TagVoteActivity: typeof TagVoteActivityComponent
  }
}

