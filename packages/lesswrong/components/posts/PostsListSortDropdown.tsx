import React, { useState } from 'react';
import { registerComponent } from '../../lib/vulcan-lib';
import { sortings } from './AllPostsPage';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';
import { QueryLink } from '../../lib/reactRouterWrapper';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';

const styles = theme => ({
  root: {
    ...theme.typography.commentStyle,
    color: theme.palette.grey[600]
  },
  selectMenu: {
    cursor: "pointer",
    paddingLeft: 4,
    color: theme.palette.primary.main
  },
  icon: {
    verticalAlign: "middle",
    position: "relative",
    top: -2,
    left: -2
  },
  menuItem: {
    '& select:focus': {
      outline: "none"
    }
  }
})

const PostsListSortDropdown = ({classes, value}:{
  classes: ClassesType,
  value: string
}) => {
  const [anchorEl, setAnchorEl] = useState(null)
  
  const newSortings = {
    ...sortings,
    relevance: "Tag Relevance"
  }

  return <div className={classes.root}>
    Sorted by 
    <span className={classes.selectMenu} onClick={e=>setAnchorEl(e.currentTarget)}>
      {newSortings[value]} <ArrowDropDownIcon className={classes.icon}/>
    </span>
    <Menu
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={()=>setAnchorEl(null)}
    >
        {Object.keys(sortings).map(sorting => (
          <QueryLink key={sorting} query={{"sortedBy":sorting}} merge>
            <MenuItem value={sorting} onClick={()=>setAnchorEl(null)} className={classes.menuItem}>
              {newSortings[sorting]}
            </MenuItem>
          </QueryLink>
        ))}
        <QueryLink query={{"sortedBy":null}} merge>
          <MenuItem value={"relevance"} onClick={()=>setAnchorEl(null)} className={classes.menuItem}>
            {newSortings["relevance"]}
          </MenuItem>
        </QueryLink>
    </Menu>
  </div>
}

const PostsListSortDropdownComponent = registerComponent('PostsListSortDropdown', PostsListSortDropdown, {styles});

declare global {
  interface ComponentTypes {
    PostsListSortDropdown: typeof PostsListSortDropdownComponent
  }
}