
import DialogueChecks from "../../lib/collections/dialogueChecks/collection";
import {randomId} from "../../lib/random";
import AbstractRepo from "./AbstractRepo";

interface DialogueCheckPostInfo extends DbDialogueCheck {
  postUserId: string,
  hasCoauthorPermission: DbPost['hasCoauthorPermission'],
  coauthorStatuses: DbPost['coauthorStatuses']
}
export default class DialogueChecksRepo extends AbstractRepo<DbDialogueCheck> {
  constructor() {
    super(DialogueChecks);
  }

  async upsertDialogueCheck(recordId: string,userId: string, targetUserId: string, checked: boolean, checkedAt: Date) {
    return this.none(`
      INSERT INTO "DialogueChecks" (
        "_id",
        "userId",
        "targetUserId",
        "checked",
        "checkedAt"
      ) VALUES (
        $1, $2, $3, $4, $5
      ) ON CONFLICT ("userId", "targetUserId") DO UPDATE SET 
        "checked" = $4,
        "checkedAt" = $5
    `, [recordId, userId, targetUserId, checked, checkedAt])
  }

  async checkForMatch(userId1: string, userId2: string): Promise<DbDialogueCheck[]> {
    return this.any(`
      SELECT 
        * 
      FROM public."DialogueChecks" 
      WHERE "targetUserId" = $1 AND "userId" = $2 AND "checked" = true
      AND EXISTS (
        SELECT 1 FROM public."DialogueChecks" 
        WHERE "targetUserId" = $2 AND "userId" = $1 AND "checked" = true
      );
    `, [userId1, userId2])
  }
}
