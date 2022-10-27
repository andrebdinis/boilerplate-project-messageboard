//'use strict';
const mongoose = require('mongoose')
//const ObjectId = require('mongoose').Types.ObjectId


// Replies (GRANDCHILD)
const replySchema = new mongoose.Schema({
  //_id: mongoose.ObjectId,
  text: { type: String, default: ''/*, required: true*/ },
  delete_password: { type: String/*, required: [true, 'Delete password required']*/ },
  reported: { type: Boolean, default: false },
  created_on: { type: Date, default: Date.now }
})
const ReplyModel = new mongoose.model('Reply', replySchema, 'replyCollection')


// Threads (CHILD)
const threadSchema = () => {
  // create the Date.now for equal date values in created_on and bumped_on fields
  const dateNow = Date.now;
  return new mongoose.Schema({
    //_id: mongoose.ObjectId,
    text: { type: String, default: ''/*, required: true*/ },
    delete_password: { type: String/*, required: [true, 'Delete password required']*/ },
    replies: { type: [replySchema] },
    reported: { type: Boolean, default: false },
    created_on: { type: Date, default: dateNow },
    bumped_on: { type: Date, default: dateNow }
  })
}
const ThreadModel = new mongoose.model('Thread', threadSchema(), 'threadCollection')


// Boards (PARENT)
const boardSchema = new mongoose.Schema({
  //_id: mongoose.ObjectId,
  name: { type: String, /*unique: true*/ },
  threads: { type: [threadSchema()] },
  created_on: { type: Date, default: Date.now }
})
const BoardModel = new mongoose.model('Board', boardSchema, 'boardCollection')

//----------------------------------------------------------------

// module.exports version
module.exports = {
  Board: BoardModel,
  Thread: ThreadModel,
  Reply: ReplyModel
}

// exports version
//exports.Board = BoardModel
//exports.Thread = ThreadModel
//exports.Reply = ReplyModel

//----------------------------------------------------------------
// Http request methods (over-simplified):
// - POST (CREATE)
// - GET (READ)
// - PUT (UPDATE)
// - DELETE (DELETE)
//----------------------------------------------------------------
// MONGOOSE DATABASE STUFF
// *A board can have one or more threads.
// *A thread can only belong to one board.
// *A thread can have one or more replies.
// *A reply can only belong to one thread.
// *When a reply is created:
//  - its thread's bumped_on is updated with the reply's created_on (to the current date and time)
//  - its thread's replies (array) will receive the new reply object
//----------------------------------------------------------------