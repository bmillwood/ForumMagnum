import React, { useEffect, useRef, useState } from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useTracking } from "../../lib/analyticsEvents";
import { gql, useQuery, useMutation } from "@apollo/client";
import { useUpdateCurrentUser } from "../hooks/useUpdateCurrentUser";
import { useCurrentUser } from '../common/withUser';
import { randomId } from '../../lib/random';
import { commentBodyStyles } from '../../themes/stylePiping';
import { useCreate } from '../../lib/crud/withCreate';
import { useNavigation } from '../../lib/routeUtil';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { useSingle } from '../../lib/crud/withSingle';
import { useMulti } from "../../lib/crud/withMulti";
import ReactConfetti from 'react-confetti';

export type UpvotedUser = {
  _id: string;
  username: string;
  displayName: string;
  total_power: number;
  power_values: string;
  vote_counts: number;
  total_agreement: number;
  agreement_values: string;
};

export type CommentCountTag = {
  name: string;
  comment_count: number;
};

export type TopCommentedTagUser = {
  _id: string;
  username: string;
  displayName: string;
  total_power: number;
  tag_comment_counts: Array<{
    name: string;
    post_comment_count: number;
  }>
};

export type UserDialogueUsefulData = {
  dialogueUsers: DbUser[],
  topUsers: UpvotedUser[],
}


const styles = (theme: ThemeType): JssStyles => ({
  root: {
    padding: 20,
    ...commentBodyStyles(theme),
  },
  matchContainer: {
    maxWidth: 1300,
    padding: 20,
    backgroundColor: theme.palette.grey[100],
    borderRadius: 5,
  },
  matchContainerGridV1: {
    display: 'grid',    //        checkbox         name         message                match                           upvotes                  agreement        posts read
    gridTemplateColumns: `minmax(min-content, 60px) 100px minmax(min-content, 80px) minmax(min-content, 300px) minmax(min-content, 45px) minmax(min-content, 80px)  550px `,
    gridRowGap: '10px',
    columnGap: '10px',
    alignItems: 'center'
  },
  matchContainerGridV2: {
    display: 'grid',    //        checkbox         name         message                match                    bio  posts read
    gridTemplateColumns: `minmax(min-content, 60px) 100px minmax(min-content, 80px) minmax(min-content, 300px) 125px  550px `,
    gridRowGap: '10px',
    columnGap: '10px',
    alignItems: 'center'
  },
  header: {
    margin: 0,
    marginBottom: 10,
    whiteSpace: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  messageButton: {
    maxHeight: `17px`,
    fontFamily: theme.palette.fonts.sansSerifStack,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.link.unmarked,
    whiteSpace: 'nowrap'
  },
  newDialogueButton: {
    maxHeight: `17px`,
    fontFamily: theme.palette.fonts.sansSerifStack,
    backgroundColor: theme.palette.primary.light,
    color: 'white',
    whiteSpace: 'nowrap'
  },
  link: {
    color: theme.palette.primary.main,
    cursor: 'pointer',
    '&:hover': {
      color: theme.palette.primary.light,
    }
  },
  rootFlex: {
    display: 'flex'
  },
  gradientBigTextContainer: {
    position: 'relative',
    height: '70px', 
    overflow: 'auto',
    color: 'grey', 
    fontSize: '14px',
    lineHeight: '1.15em',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
    '&.scrolled-to-bottom': {
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)',
    },
    '&.scrolled-to-top': {
      WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
    }
  },
  privacyNote: {
    color: 'grey',
    fontSize: '1rem',
  },
  checkbox: {
    color: 'default',
    '&$checked': {
      color: 'default',
    },
  },
  checked: {},
  checkboxCheckedMatched: {
    color: 'green',
    '&$checked': {
      color: 'green',
    },
  },
  checkboxCheckedNotMatched: {
    color: '#ADD8E6',
    '&$checked': {
      color: '#00000038',
    },
  },
  centeredText: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const useScrollGradient = (ref: React.RefObject<HTMLDivElement>) => {
  const [isScrolledToTop, setIsScrolledToTop] = useState(true);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const element = ref.current;
      if (element) {
        const atTop = element.scrollTop <= (element.scrollHeight * 0.10);
        const atBottom = (element.scrollHeight - element.scrollTop) <= (element.clientHeight * 1.10);
        setIsScrolledToTop(atTop);
        setIsScrolledToBottom(atBottom);
      }
    };

    ref.current?.addEventListener('scroll', handleScroll);
    return () => ref.current?.removeEventListener('scroll', handleScroll);
  }, [ref]);

  return { isScrolledToTop, isScrolledToBottom };
};

const UserBio = ({ classes, userId }: { classes: ClassesType, userId: string }) => {
  const { document: userData, loading } = useSingle({
    documentId: userId,
    collectionName: "Users",
    fragmentName: "UsersProfile"
  });

  const bioContainerRef = useRef<HTMLDivElement | null>(null);
  const { isScrolledToTop, isScrolledToBottom } = useScrollGradient(bioContainerRef);

  return (
    <div className={`${classes.gradientBigTextContainer} ${isScrolledToTop ? 'scrolled-to-top' : ''} ${isScrolledToBottom ? 'scrolled-to-bottom' : ''}`} ref={bioContainerRef}>
      {userData?.biography?.plaintextDescription }
    </div>
  )
};

const UserPostsYouveRead = ({ classes, targetUserId, limit = 20}: { classes: ClassesType, targetUserId: string, limit?: number, components: ComponentTypes }) => {
  const currentUser = useCurrentUser();
  const { PostsTooltip } = Components;


  const { loading, error, data } = useQuery(gql`
    query UsersReadPostsOfTargetUser($userId: String!, $targetUserId: String!, limit: Int) {
      UsersReadPostsOfTargetUser(userId: $userId, targetUserId: $targetUserId, limit: $limit) {
        _id
        title
      }
    }
  `, {
    variables: { userId: currentUser?._id, targetUserId: targetUserId, limit : limit },
  });

  const readPosts:DbPost[] = data?.UsersReadPostsOfTargetUser

  const readPostsContainerRef = useRef<HTMLDivElement | null>(null);
  const { isScrolledToTop, isScrolledToBottom } = useScrollGradient(readPostsContainerRef);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className={`${classes.gradientBigTextContainer} ${isScrolledToTop ? 'scrolled-to-top' : ''} ${isScrolledToBottom ? 'scrolled-to-bottom' : ''}`} ref={readPostsContainerRef}>
      {readPosts.length > 0 ? (
        readPosts.slice(0, 8).map((post, index) => {
            return (
              <PostsTooltip key={index} postId={post._id}>
                <a key={index} href={"https://www.lesswrong.com/posts/gDijQHHaZzeGrv2Jc/"+post._id}>• {post.title}</a>
                <br/>
              </PostsTooltip>
            )
          })
      ) : (
        <p>(no posts read...)</p>
      )}
    </div>
  );
};

const Headers = ({ titles, className }: { titles: string[], className: string }) => {
  return (
    <>
      {titles.map((title, index) => (
        <h5 key={index} className={className}>{title}</h5>
      ))}
    </>
  );
};

const DialogueCheckBox: React.FC<{
  targetUserId : string;
  targetUserDisplayName : string;
  checkId?: string;
  isChecked: boolean, 
  isMatched: boolean;
  classes: ClassesType;
}> = ({ targetUserId, targetUserDisplayName, checkId, isChecked, isMatched, classes}) => {
  const currentUser = useCurrentUser();
  const { captureEvent } = useTracking(); //it is virtuous to add analytics tracking to new components

  const [localChecked, setLocalChecked] = useState(false);
  const [upsertDialogueCheck] = useMutation(gql`
    mutation upsertUserDialogueCheck($targetUserId: String!, $checked: Boolean!) {
      upsertUserDialogueCheck(targetUserId: $targetUserId, checked: $checked) {
          _id
          __typename
          userId
          targetUserId
          checked
          match
        }
      }
    `)

  async function handleNewMatchAnonymisedAnalytics() {
    captureEvent("newDialogueReciprocityMatch", {}) // we only capture match metadata and don't pass anything else

    // ping the slack webhook to inform team of match. YOLO:ing and putting this on the client. Seems fine: but it's the second time this happens, and if we're doing it a third time, I'll properly move it all to the server 
    const webhookURL = "https://hooks.slack.com/triggers/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";
    const data = { // Not sending any data for now
    };

    try {
      const response = await fetch(webhookURL, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      //eslint-disable-next-line no-console
      console.error('There was a problem with the fetch operation: ', error);
    }
    
  }

  const [showConfetti, setShowConfetti] = useState(false);


  async function updateDatabase(event: React.ChangeEvent<HTMLInputElement>, targetUserId:string, handleConfetti:React.Dispatch<React.SetStateAction<boolean>>, checkId?:string, ) {
    if (!currentUser) return;

    const tgt = event.target;
    if (!(tgt instanceof HTMLInputElement)) return;

    const response = await upsertDialogueCheck({
      variables: {
        targetUserId: targetUserId, 
        checked: tgt.checked
      },
      update(cache, { data }) {
        if (!checkId) {
          cache.modify({
            fields: {
              getUsersDialogueChecks(existingChecksRefs = []) {
                const newCheckRef = cache.writeFragment({
                  data: data.upsertUserDialogueCheck,
                  fragment: gql`
                    fragment NewCheck on DialogueChecks {
                      _id
                      __typename
                      userId
                      targetUserId
                      checked
                      match
                    }
                  `
                });
                const newData = [...existingChecksRefs, newCheckRef]
                return newData;
              }
            }
          });
        }
      },
      optimisticResponse: {
        upsertUserDialogueCheck: {
          _id: checkId || randomId(),
          __typename: 'DialogueCheck',
          userId: currentUser._id,
          targetUserId: targetUserId,
          checked: event.target.checked,
          match: false 
        }
      }
    })
    
    if (response.data.upsertUserDialogueCheck.match) {
      void handleNewMatchAnonymisedAnalytics()
      handleConfetti(true);
      setTimeout(() => handleConfetti(false), 5000); // Reset the variable after 5 so it can be clicked again
    }
  }

  const checkboxClass = isChecked 
    ? (isMatched ? classes.checkboxCheckedMatched : classes.checkboxCheckedNotMatched)
    : classes.checkbox

  return (
    <>
      {showConfetti && <ReactConfetti recycle={false} colors={["#7faf83", "#00000038" ]} />}
      <FormControlLabel
        control={ 
          <Checkbox 
            classes={{
              root: checkboxClass,
              checked: classes.checked,
            }}
            onChange={event => updateDatabase(event, targetUserId, setShowConfetti, checkId) } 
            checked={isChecked}
          />
        }
        label=""
      />
    </>
  );
};

const isMatched = (userDialogueChecks: DialogueCheckInfo[], targetUserId: string): boolean => {
  return userDialogueChecks.some(check => check.targetUserId === targetUserId && check.match);
};

const isChecked = (userDialogueChecks: DialogueCheckInfo[], targetUserId: string): boolean => {
  return userDialogueChecks?.find(check => check.targetUserId === targetUserId)?.checked || false;
};

type MatchDialogueButtonProps = {
  isMatched: boolean;
  targetUserId: string;
  targetUserDisplayName: string;
  currentUser: any; // replace with the correct type
  loadingNewDialogue: boolean;
  createDialogue: (title: string, participants: string[]) => void;
  classes: ClassesType;
};

const MatchDialogueButton: React.FC<MatchDialogueButtonProps> = ({
  isMatched,
  targetUserId,
  targetUserDisplayName,
  currentUser,
  loadingNewDialogue,
  createDialogue,
  classes,
}) => {
  return (
    <div>
      {isMatched ? (
        <button
          className={classes.newDialogueButton}
          onClick={(e) =>
            createDialogue(
              `${currentUser?.displayName}/${targetUserDisplayName}`,
              [targetUserId]
            )
          }
        >
          {loadingNewDialogue ? <a data-cy="message">Creating New Dialogue...</a> : <a data-cy="message">Start Dialogue</a>}
        </button>
      ) : null}
    </div>
  );
};

const MessageButton: React.FC<{
  targetUserId: string;
  currentUser: any; // replace with the correct type
  classes: ClassesType;
}> = ({ targetUserId, currentUser, classes }) => {
  const { NewConversationButton } = Components;
  
  return (
    <button className={classes.messageButton}>
      <NewConversationButton user={{_id: targetUserId}} currentUser={currentUser}>
        <a data-cy="message">Message</a>
      </NewConversationButton>
    </button>
  );
};

export const DialogueMatchingPage = ({classes}: {
  classes: ClassesType,
}) => {
  
  const { captureEvent } = useTracking(); //it is virtuous to add analytics tracking to new components

  const updateCurrentUser = useUpdateCurrentUser()
  const [optIn, setOptIn] = React.useState(false); // for rendering the checkbox

  const { UsersName, LoadMore } = Components;

  const {create: createPost, loading: loadingNewDialogue, error: newDialogueError} = useCreate({ collectionName: "Posts", fragmentName: "PostsEdit" });
  const { history } = useNavigation();

  const { loading, error, data } = useQuery(gql`
    query getDialogueUsers {
      GetUserDialogueUsefulData {
        dialogueUsers {
          _id
          displayName
          karma
        }
        topUsers {
          _id
          displayName
          total_power
          total_agreement
        }
       }
    }
  `);

  const userDialogueUsefulData : UserDialogueUsefulData = data?.GetUserDialogueUsefulData
  const currentUser = useCurrentUser();

  const {loading: userLoading, results : userDialogueChecks} = useMulti({
    terms: {
      view: "userDialogueChecks",
      userId: currentUser?._id,
      limit: 1000,
    },
    fragmentName: "DialogueCheckInfo",
    collectionName: "DialogueChecks",
  });

  const [localDialogueChecks, setLocalDialogueChecks] = useState(userDialogueChecks ?? []);

  const {loading: userOptedInLoading, results : UsersOptedInToDialogueFacilitation, loadMoreProps} = useMulti({
    terms: { 
      view: 'usersWithOptedInToDialogueFacilitation',
      limit: 10, 
      sort: { karma: -1 } 
    },
    fragmentName: 'UsersOptedInToDialogueFacilitation',
    collectionName: 'Users'  
  });

  // // get all check rows where user is currentUser and checked is true
  // const GET_USERS_DIALOGUE_CHECKS = gql`
  //   query getUsersDialogueChecks {
  //     getUsersDialogueChecks {
  //       _id
  //       __typename
  //       userId
  //       targetUserId
  //       checked
  //       match
  //     }
  //   }
  // `;

  // // useMulti fetching from dialogueChecks based on a view, which takes as a usedId as an input. 
  // // permission stuff happens in the background
  
  // const { loading: loadingChecks, error: errorChecks, data: dataChecks } = useQuery(GET_USERS_DIALOGUE_CHECKS);  // for all the targetUsers thus obtained, check if there's a match 

  let targetUserIds = [];
  if (userDialogueChecks) {
    targetUserIds = userDialogueChecks.map(check => check.targetUserId);
  }

  async function createDialogue(title: string, participants: string[]) {
    const createResult = await createPost({
      data: {
        title,
        draft: true,
        collabEditorDialogue: true,
        coauthorStatuses: participants.map(userId => ({userId, confirmed: true, requested: false})),
        shareWithUsers: participants,
        sharingSettings: {
          anyoneWithLinkCan: "none",
          explicitlySharedUsersCan: "edit",
        },
        contents: {
          originalContents: {
            type: "ckEditorMarkup",
            data: ""
          }
        } as AnyBecauseHard
      },
    });
    if (createResult?.data?.createPost?.data) {
      const post = createResult?.data?.createPost?.data;
      if (post) {
        const postId = post._id;
        const postEditUrl = `/editPost?postId=${postId}`;
        history.push(postEditUrl);
      }
    }
  }

  if (!currentUser) return <p>You have to be logged in to view this page</p>
  if (loading) return <p>Loading...</p>;
  if (error || !userDialogueChecks || userDialogueChecks.length > 1000) return <p>Error </p>; // if the user has clicked that much stuff things might break...... 
  if (userDialogueChecks?.length > 1000) {
    console.log("Warning: userDialogueChecks.length > 1000, seems user has checked more than a thousand boxes? how is that even possible? let a dev know and we'll fix it...")
  }

  const handleOptInToRevealDialogueChecks = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptIn(event.target.checked);
    void updateCurrentUser({revealChecksToAdmins: event.target.checked})
    captureEvent("optInToRevealDialogueChecks", {optIn: event.target.checked})
    
    const userDetailString = currentUser?.displayName + " / " + currentUser?.slug
  
    // ping the slack webhook to inform team of opt-in. YOLO:ing and putting this on the client. Seems fine. 
    const webhookURL = "https://hooks.slack.com/triggers/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" // dev mode link for now, update before pushing to prod "https://hooks.slack.com/triggers/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";
    const data = {
      user: userDetailString,
    };
  
    if (event.target.checked) {
      try {
        const response = await fetch(webhookURL, {
          method: 'POST',
          body: JSON.stringify(data),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        //eslint-disable-next-line no-console
        console.error('There was a problem with the fetch operation: ', error);
      }
    }
  };

  const prompt = "Opt-in to LessWrong team viewing your checks, to help proactively suggest and facilitate dialogues" 

  const isMobile = window.innerWidth <= 768; // Adjust this value as needed


  return (
    
    <div className={classes.root}>
      
      <div style={{ maxWidth: '1100px', margin: 'auto' }}>

      {isMobile && (
        <div style={{ backgroundColor: 'yellow', padding: '10px', marginBottom: '20px', maxWidth: '40vw' }}>
          Dialogues matching doesn't render well on mobile right now. <br/> <br /> Please view on laptop or tablet!
        </div>
      )}

      <h1>Dialogue Matching</h1>
      <p>Check a user you'd be interested in having a dialogue with, if they were interested too. Users will 
        not see whether you have checked them unless they have also checked you. A check is not a commitment, just an indication of interest.
        You can message people even if you haven't matched. 
        (Also, there are no notifications on match, as we haven't built that yet. You'll have to keep checking the page :)</p>
        
      <div style={{ height: '20px', display: 'flex', alignItems: 'top' }}>
            <FormControlLabel  style={{ paddingLeft: '8px' }}
              control={
                <Checkbox
                  checked={optIn}
                  onChange={event => handleOptInToRevealDialogueChecks(event)}
                  name="optIn"
                  color="primary"
                  style={{ height: '10px', width: '30px', color: "#9a9a9a" }}
                />
              }
              label={<span className={classes.prompt} >{prompt}</span>}
            />
          </div> 
        <p className={classes.privacyNote}>On privacy: LessWrong team does not look at user’s checks. We do track metadata, like “Two users just matched”, 
          to help us know whether the feature is getting used. If one user opts in to revealing their checks we can still not see their matches, unless 
          the other part of the match has also opted in.</p>      
        <div className={classes.rootFlex}>
        <div className={classes.matchContainer}>
          <h3>Your top upvoted users (last 1.5 years)</h3>
          <div className={classes.matchContainerGridV1}>
            <Headers titles={["Dialogue", "Name", "Message", "Match", "Karma", "Agreement", "Posts you've read"]} className={classes.header} />
            {userDialogueUsefulData.topUsers.slice(0,20).map(targetUser => {
              const checkId = userDialogueChecks?.find(check => check.targetUserId === targetUser._id)?._id
              return (
                <React.Fragment key={targetUser._id}>
                  <DialogueCheckBox 
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName} 
                    checkId={checkId} 
                    isChecked={isChecked(userDialogueChecks, targetUser._id)}
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    classes={classes}
                  />
                  <UsersName 
                    className={classes.displayName} 
                    documentId={targetUser._id} 
                    simple={false}/>
                  <MessageButton 
                    targetUserId={targetUser._id} 
                    currentUser={currentUser} 
                    classes={classes} />
                  <MatchDialogueButton
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName}
                    currentUser={currentUser}
                    loadingNewDialogue={loadingNewDialogue}
                    createDialogue={createDialogue}
                    classes={classes}
                  />
                  <div className={classes.centeredText}>{targetUser.total_power}</div>
                  <div className={classes.centeredText}>{targetUser.total_agreement}</div>
                  <UserPostsYouveRead 
                    classes={classes} 
                    targetUserId={targetUser._id} 
                    limit={20}
                    components={Components} />
                </React.Fragment> 
              )}
            )}
          </div>
        </div>
      </div>
      <br />
      <div className={classes.rootFlex}>
        <div className={classes.matchContainer}>
          <h3>Users who published dialogues</h3>
          <div className={classes.matchContainerGridV2}>
            <Headers titles={["Dialogue", "Name", "Message", "Match", "Bio", "Posts you've read"]} className={classes.header} />
            {userDialogueUsefulData.dialogueUsers.map(targetUser => {
              const checkId = userDialogueChecks?.find(check => check.targetUserId === targetUser._id)?._id
              
              return (
                <React.Fragment key={`${targetUser._id}_other`}> 
                  <DialogueCheckBox 
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName} 
                    checkId={checkId} 
                    isChecked={isChecked(userDialogueChecks, targetUser._id)}
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    classes={classes}
                  />
                  <UsersName 
                    className={classes.displayName} 
                    documentId={targetUser._id} 
                    simple={false}/>
                  <MessageButton 
                    targetUserId={targetUser._id} 
                    currentUser={currentUser} 
                    classes={classes} />
                  <MatchDialogueButton
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName}
                    currentUser={currentUser}
                    loadingNewDialogue={loadingNewDialogue}
                    createDialogue={createDialogue}
                    classes={classes}
                  />
                  <UserBio 
                    key={targetUser._id} 
                    classes={classes} 
                    userId={targetUser._id} />
                  <UserPostsYouveRead 
                    classes={classes} 
                    targetUserId={targetUser._id} 
                    limit={20}
                    components={Components} />
                </React.Fragment> 
              )}
            )}
          </div>
        </div>
      </div>
      <br />
      <div className={classes.rootFlex}>
        <div className={classes.matchContainer}>
          <h3>Users who opted in to dialogue invitations on frontpage</h3>
          <div className={classes.matchContainerGridV2}> 
          <Headers titles={["Dialogue", "Name", "Message", "Match", "Bio", "Posts you've read"]} className={classes.header} />
            {UsersOptedInToDialogueFacilitation?.map(targetUser => {
              const checkId = userDialogueChecks?.find(check => check.targetUserId === targetUser._id)?._id
              return (
                <React.Fragment key={`${targetUser._id}_other`}> 
                  <DialogueCheckBox 
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName} 
                    checkId={checkId} 
                    isChecked={isChecked(userDialogueChecks, targetUser._id)}
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    classes={classes}
                  />
                  <UsersName 
                    className={classes.displayName} 
                    documentId={targetUser._id} 
                    simple={false}/>
                  <MessageButton 
                    targetUserId={targetUser._id} 
                    currentUser={currentUser} 
                    classes={classes} />
                  <MatchDialogueButton
                    isMatched={isMatched(userDialogueChecks, targetUser._id)}
                    targetUserId={targetUser._id}
                    targetUserDisplayName={targetUser.displayName}
                    currentUser={currentUser}
                    loadingNewDialogue={loadingNewDialogue}
                    createDialogue={createDialogue}
                    classes={classes}
                  />
                  <UserBio 
                    key={targetUser._id} 
                    classes={classes} 
                    userId={targetUser._id} />
                  <UserPostsYouveRead 
                    classes={classes} 
                    targetUserId={targetUser._id} 
                    components={Components} />
                </React.Fragment> 
              )}
            )}
          </div>
          <LoadMore {...loadMoreProps} />
        </div>
      </div>
      </div>
    </div>
  );
}

const DialogueMatchingPageComponent = registerComponent('DialogueMatchingPage', DialogueMatchingPage, {styles});

declare global {
  interface ComponentTypes {
    DialogueMatchingPage: typeof DialogueMatchingPageComponent
  }
}
