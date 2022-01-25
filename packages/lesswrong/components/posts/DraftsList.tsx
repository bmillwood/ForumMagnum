import { registerComponent, Components } from '../../lib/vulcan-lib';
import React, {useCallback, useState} from 'react';
import { useCurrentUser } from '../common/withUser';
import withErrorBoundary from '../common/withErrorBoundary';
import {useMulti} from "../../lib/crud/withMulti";
import { useUpdate } from '../../lib/crud/withUpdate';
import {useLocation} from "../../lib/routeUtil";
import {Link} from "../../lib/reactRouterWrapper";
import DescriptionIcon from "@material-ui/icons/Description";
import ListIcon from '@material-ui/icons/List';

const styles = (theme: ThemeType): JssStyles => ({
  draftsHeaderRow: {
    display: 'flex'
  },
  newPostButton: {
    marginRight: 20
  },
  draftsPageButton: {
    marginRight: 20
  }
})

export const sortings: Partial<Record<string,string>> = {
  newest: "Most Recently Created",
  lastModified: "Last Modified",
  wordCountAscending: "Shortest First",
  wordCountDescending: "Longest First",
}

const DraftsList = ({terms, title="My Drafts", showAllDraftsLink=true, classes}: {
  terms: PostsViewTerms,
  title?: string,
  showAllDraftsLink?: boolean,
  classes: ClassesType
}) => {
  const currentUser = useCurrentUser();
  const { PostsItem2, Loading } = Components
  
  const { query } = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  
  const {mutate: updatePost} = useUpdate({
    collectionName: "Posts",
    fragmentName: 'PostsList',
  });
  
  const toggleDelete = useCallback((post) => {
    // if (post.deletedDraft||confirm("Are you sure you want to delete this post?")) { //don't confirm to undelete
    void updatePost({
      selector: {_id: post._id},
      data: {deletedDraft:!post.deletedDraft, draft: true} //undeleting goes to draft
    })
    // }
  }, [updatePost])
  
  const { results, loading, loadMoreProps } = useMulti({
    terms,
    collectionName: "Posts",
    fragmentName: 'PostsList',
    enableTotal: true,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: "cache-first",
  });
  
  if (!currentUser) return null
  if (!results && loading) return <Loading />
  
  const currentSorting = query.sortDraftsBy || query.view ||  "lastModified"
  const currentIncludeEvents = (query.includeDraftEvents === 'true')
  const currentIncludeArchived = (query.includeArchived === 'true')
  terms.excludeEvents = !currentIncludeEvents 
  
  
  return <div>
    <Components.SectionTitle title={title}>
      <div className={classes.draftsHeaderRow}>
        <div className={classes.newPostButton}>
          <Link to={"/newPost"}>
            <Components.SectionButton>
              <DescriptionIcon /> New Post
            </Components.SectionButton>
          </Link>
        </div>
        {showAllDraftsLink && <div className={classes.draftsPageButton}>
          <Link to={"/drafts"}>
            <Components.SectionButton>
              <ListIcon /> All Drafts
            </Components.SectionButton>
          </Link>
        </div>}
        <div className={classes.settingsButton} onClick={() => setShowSettings(!showSettings)}>
          <Components.SettingsButton label={`Sorted by ${ sortings[currentSorting]}`}/>
        </div>
      </div>
    </Components.SectionTitle>
    {showSettings && <Components.DraftsListSettings
      hidden={false}
      currentSorting={currentSorting}
      currentIncludeEvents={currentIncludeEvents}
      currentIncludeArchived={currentIncludeArchived}
      sortings={sortings}
    />}
    {results
      .map((post: PostsList, i: number) =>
      <PostsItem2
        key={post._id} 
        post={post}
        draft
        toggleDeleteDraft={toggleDelete}
        hideAuthor
        showDraftTag={false}
        showPersonalIcon={false}
        showBottomBorder={i < results.length-1}
        strikethroughTitle={post.deletedDraft}
      />
    )}
    <Components.LoadMore {...{...loadMoreProps, count: undefined, totalCount: undefined }}/>
  </div>
}

const DraftsListComponent = registerComponent('DraftsList', DraftsList, {
  hocs: [withErrorBoundary], styles
});

declare global {
  interface ComponentTypes {
    DraftsList: typeof DraftsListComponent
  }
}

