/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module mention/mentioncommand
 */

import { Command } from 'ckeditor5/src/core';
import { CKEditorError, toMap } from 'ckeditor5/src/utils';


/**
 * The mention command.
 *
 * The command is registered by {@link module:mention/mentionediting~MentionEditing} as `'mention'`.
 *
 * To insert a mention onto a range, execute the command and specify a mention object with a range to replace:
 *
 *		const focus = editor.model.document.selection.focus;
 *
 *		// It will replace one character before the selection focus with the '#1234' text
 *		// with the mention attribute filled with passed attributes.
 *		editor.execute( 'mention', {
 *			marker: '#',
 *			mention: {
 *				id: '#1234',
 *				name: 'Foo',
 *				title: 'Big Foo'
 *			},
 *			range: editor.model.createRange( focus, focus.getShiftedBy( -1 ) )
 *		} );
 *
 *		// It will replace one character before the selection focus with the 'The "Big Foo"' text
 *		// with the mention attribute filled with passed attributes.
 *		editor.execute( 'mention', {
 *			marker: '#',
 *			mention: {
 *				id: '#1234',
 *				name: 'Foo',
 *				title: 'Big Foo'
 *			},
 *			text: 'The "Big Foo"',
 *			range: editor.model.createRange( focus, focus.getShiftedBy( -1 ) )
 *		} );
 *
 * @extends module:core/command~Command
 */
export default class MentionCommand extends Command {

	/**
	 * Executes the command.
	 *
	 * @param {Object} [options] Options for the executed command.
	 * @param {Object} options.mention Must be an object with id and link
	 * @param {String} options.marker The marker character (e.g. `'@'`).
	 * @param {String} [options.text] The text of the inserted mention. Defaults to the full mention string composed from `marker` and
	 * `mention.id` if an object is passed.
	 * @param {module:engine/model/range~Range} [options.range] The range to replace.
	 * Note that the replaced range might be shorter than the inserted text with the mention attribute.
	 * @fires execute
	 */
	execute( options: AnyBecauseTodo ) {
		const model = this.editor.model;
		const document = model.document;
		const selection = document.selection;

		const mentionData = options.mention;
		const mentionID = mentionData.id;

		const range = options.range || selection.getFirstRange();

		const mentionText = options.text || mentionID;


		if ( options.marker.length != 1 ) {
			/**
			 * The marker must be a single character.
			 *
			 * Correct markers: `'@'`, `'#'`.
			 *
			 * Incorrect markers: `'$$'`, `'[@'`.
			 *
			 * See {@link module:mention/mention~MentionConfig}.
			 *
			 * @error mentioncommand-incorrect-marker
			 */
			throw new CKEditorError(
				'mentioncommand-incorrect-marker',
				this
			);
		}

		if ( mentionID.charAt( 0 ) != options.marker ) {
			/**
			 * The feed item ID must start with the marker character.
			 *
			 * Correct mention feed setting:
			 *
			 *		mentions: [
			 *			{
			 *				marker: '@',
			 *				feed: [ '@Ann', '@Barney', ... ]
			 *			}
			 *		]
			 *
			 * Incorrect mention feed setting:
			 *
			 *		mentions: [
			 *			{
			 *				marker: '@',
			 *				feed: [ 'Ann', 'Barney', ... ]
			 *			}
			 *		]
			 *
			 * See {@link module:mention/mention~MentionConfig}.
			 *
			 * @error mentioncommand-incorrect-id
			 */
			throw new CKEditorError(
				'mentioncommand-incorrect-id',
				this
			);
		}

		model.change( writer => {
			const currentAttributes = toMap( selection.getAttributes() );
			const attributesWithMention = new Map( currentAttributes.entries() );

		  	attributesWithMention.set( 'linkHref', mentionData.link );

			// Replace a range with the text with link attribute.
			model.insertContent( writer.createText( mentionText, attributesWithMention ), range );
			model.insertContent( writer.createText( ' ', currentAttributes ), range.start.getShiftedBy( mentionText.length ) );
		} );
	}
}
