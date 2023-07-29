document.getElementById("myBoard").style.width = min(window.innerWidth, window.innerHeight)*0.75 + "px";
document.getElementById("history").style.height = document.getElementById("myBoard").style.width.split("px")[0] + "px";

var board = null
var game = new Chess()
var whiteSquareGrey = '#a9a9a9'
var blackSquareGrey = '#696969'

function removeGreySquares () {
  $('#myBoard .square-55d63').css('background', '')
}

function greySquare (square) {
  var $square = $('#myBoard .square-' + square)

  var background = whiteSquareGrey
  if ($square.hasClass('black-3c85d')) {
    background = blackSquareGrey
  }

  $square.css('background', background)
}

function onDragStart (source, piece) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // or if it's not that side's turn
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  removeGreySquares()

  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  })

  // illegal move
  if (move === null) return 'snapback'
  
  document.getElementById("history").innerHTML += "<h3 ><i class=\"fa-solid fa-user\"></i> Player: " + move.from + " -> " + move.to + "</h3>";

}

function onMouseoverSquare (square, piece) {
	// get list of possible moves for this square
	var moves = game.moves({
		square: square,
		verbose: true
	})

	// exit if there are no moves available for this square
	if (moves.length === 0) return

	// highlight the square they moused over
	greySquare(square)

	// highlight the possible squares for this piece
	for (var i = 0; i < moves.length; i++) {
		greySquare(moves[i].to)
	}
}

function onMouseoutSquare (square, piece) {
  removeGreySquares()
}

function onSnapEnd () {
  board.position(game.fen())
}

var config = {
    position: 'start',
    draggable: true,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
}
board = Chessboard('myBoard', config)


function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

//////////////////// ALPHA BETA PRUNING //////////////////////
var ai = 'b';
var human = 'w';
var MAX_DEPTH = 2; // max depth of the tree

var force_stop = false; // if true, stop the game.

// adapted from sunfish chess engine
var weights = { 'p': 100, 'n': 280, 'b': 320, 'r': 479, 'q': 929, 'k': 60000, 'k_e': 60000 };
var pst_w = {
    'p':[
            [ 100, 100, 100, 100, 105, 100, 100,  100],
            [  78,  83,  86,  73, 102,  82,  85,  90],
            [   7,  29,  21,  44,  40,  31,  44,   7],
            [ -17,  16,  -2,  15,  14,   0,  15, -13],
            [ -26,   3,  10,   9,   6,   1,   0, -23],
            [ -22,   9,   5, -11, -10,  -2,   3, -19],
            [ -31,   8,  -7, -37, -36, -14,   3, -31],
            [   0,   0,   0,   0,   0,   0,   0,   0]
        ],
    'n': [ 
            [-66, -53, -75, -75, -10, -55, -58, -70],
            [ -3,  -6, 100, -36,   4,  62,  -4, -14],
            [ 10,  67,   1,  74,  73,  27,  62,  -2],
            [ 24,  24,  45,  37,  33,  41,  25,  17],
            [ -1,   5,  31,  21,  22,  35,   2,   0],
            [-18,  10,  13,  22,  18,  15,  11, -14],
            [-23, -15,   2,   0,   2,   0, -23, -20],
            [-74, -23, -26, -24, -19, -35, -22, -69]
        ],
    'b': [ 
            [-59, -78, -82, -76, -23,-107, -37, -50],
            [-11,  20,  35, -42, -39,  31,   2, -22],
            [ -9,  39, -32,  41,  52, -10,  28, -14],
            [ 25,  17,  20,  34,  26,  25,  15,  10],
            [ 13,  10,  17,  23,  17,  16,   0,   7],
            [ 14,  25,  24,  15,   8,  25,  20,  15],
            [ 19,  20,  11,   6,   7,   6,  20,  16],
            [ -7,   2, -15, -12, -14, -15, -10, -10]
        ],
    'r': [  
            [ 35,  29,  33,   4,  37,  33,  56,  50],
            [ 55,  29,  56,  67,  55,  62,  34,  60],
            [ 19,  35,  28,  33,  45,  27,  25,  15],
            [  0,   5,  16,  13,  18,  -4,  -9,  -6],
            [-28, -35, -16, -21, -13, -29, -46, -30],
            [-42, -28, -42, -25, -25, -35, -26, -46],
            [-53, -38, -31, -26, -29, -43, -44, -53],
            [-30, -24, -18,   5,  -2, -18, -31, -32]
        ],
    'q': [   
            [  6,   1,  -8,-104,  69,  24,  88,  26],
            [ 14,  32,  60, -10,  20,  76,  57,  24],
            [ -2,  43,  32,  60,  72,  63,  43,   2],
            [  1, -16,  22,  17,  25,  20, -13,  -6],
            [-14, -15,  -2,  -5,  -1, -10, -20, -22],
            [-30,  -6, -13, -11, -16, -11, -16, -27],
            [-36, -18,   0, -19, -15, -15, -21, -38],
            [-39, -30, -31, -13, -31, -36, -34, -42]
        ],
    'k': [  
            [  4,  54,  47, -99, -99,  60,  83, -62],
            [-32,  10,  55,  56,  56,  55,  10,   3],
            [-62,  12, -57,  44, -67,  28,  37, -31],
            [-55,  50,  11,  -4, -19,  13,   0, -49],
            [-55, -43, -52, -28, -51, -47,  -8, -50],
            [-47, -42, -43, -79, -64, -32, -29, -32],
            [ -4,   3, -14, -50, -57, -18,  13,   4],
            [ 17,  30,  -3, -14,   6,  -1,  40,  18]
        ],

    // Endgame King Table
    'k_e': [
            [-50, -40, -30, -20, -20, -30, -40, -50],
            [-30, -20, -10,   0,   0, -10, -20, -30],
            [-30, -10,  20,  30,  30,  20, -10, -30],
            [-30, -10,  30,  40,  40,  30, -10, -30],
            [-30, -10,  30,  40,  40,  30, -10, -30],
            [-30, -10,  20,  30,  30,  20, -10, -30],
            [-30, -30,   0,   0,   0,   0, -30, -30],
            [-50, -30, -30, -30, -30, -30, -30, -50]
        ]
};
var pst_b = {
    'p': pst_w['p'].slice().reverse(),
    'n': pst_w['n'].slice().reverse(),
    'b': pst_w['b'].slice().reverse(),
    'r': pst_w['r'].slice().reverse(),
    'q': pst_w['q'].slice().reverse(),
    'k': pst_w['k'].slice().reverse(),
    'k_e': pst_w['k_e'].slice().reverse()
}
////////////////////////////////////

function max(a,b){
	if (a>b) return a;
	return b;
}

function min(a,b){
	if (a<b) return a;
	return b;
}

function utility(tmp_game){
	var value = 0;
	var b = tmp_game.board();
	var pst = null;
	if (tmp_game.turn() == ai){
		pst = pst_b;
	}
	else {
		pst = pst_w;
	}
	for (var i = 0 ; i<8 ; i++){
		for (var j = 0 ; j<8 ; j++){
			var p = tmp_game.board()[i][j];
			if (p == null) continue;
			var x = 1;
			if (p.color == human){
				x *= -1;
			}
			value += x * weights[p.type] + pst[p.type][i][j];
		}
	}
	// console.log(value);
	return value;
}

function maxValue(tmp_game, alpha, beta, depth){
    // return [utility, move]
    if (tmp_game.in_checkmate() || tmp_game.in_stalemate() || tmp_game.moves().length == 0) {
        return [utility(tmp_game), null];
    }
	if (depth == MAX_DEPTH){
		// console.log("depth reached");
		return [utility(tmp_game), null];
	}
    var b = beta.val;
	var a = alpha.val;
    var max_v  = -Infinity;
    var max_move = null;
    var moves = tmp_game.moves({verbose: true});
    for (var i = 0 ; i<moves.length; i++){
		tmp_game.move(moves[i]);
		// console.log(moves[i]);
        var tmp_val = minValue(tmp_game, alpha, beta, depth+1)[0];
		// console.log(tmp_val);
        if (tmp_val > max_v){
			max_v = tmp_val;
			max_move = moves[i];
			a = max(a , max_v);
        }
		if (b <= max_v){
			alpha.val = a;
			return [max_v, max_move];
		}
		tmp_game.undo();
    }
	// console.log("max_value : ");
	// console.log(max_v, max_move);
	return [max_v , max_move];
}

function minValue(tmp_game, alpha, beta, depth){
	// return [utility, move]
    if (tmp_game.in_checkmate() || tmp_game.in_stalemate() || tmp_game.moves().length == 0) {
        return [utility(tmp_game), null];
    }
	if (depth == MAX_DEPTH){
		// console.log("depth reached");
		return [utility(tmp_game), null];
	}
    var min_v  = Infinity;
    var min_move = null;
    var b = beta.val;
    var a = alpha.val;
    var moves = tmp_game.moves({verbose: true});
    for (var i = 0 ; i<moves.length; i++){
		tmp_game.move(moves[i]);
		// console.log(moves[i]);
        var tmp_val = maxValue(tmp_game, alpha, beta, depth+1)[0] ;
		// console.log(tmp_val);
        if (tmp_val < min_v){
          min_v = tmp_val;
          min_move = moves[i];
          b = min(b, min_v);
        }
		if (min_v <= a){
			beta.val = b;
			return [min_v, min_move];
		}
		tmp_game.undo();
    }
	// console.log("min_value: ");
	// console.log(min_v, min_move);
	return [min_v, min_move];
}

function alphaBetaPruning(fen){
    var tmp_game = new Chess();
    tmp_game.load(fen);
	var alpha = {val : -Infinity};
	var beta = {val : Infinity};
	console.log(alpha.val, beta.val);
    var m = maxValue(tmp_game, alpha, beta, 0);
	console.log(m);
	return m[1]; 
}

async function play(){
  reset();
  force_stop = false;

  document.getElementById("reset").removeAttribute("disabled");
  document.getElementById("resign").removeAttribute("disabled");
  document.getElementById("start").setAttribute("disabled", "disabled");
  document.getElementById("flip").setAttribute("disabled", "disabled");
  document.getElementById("difficulty").setAttribute("disabled", "disabled");

	while (game.in_checkmate() == false && game.in_stalemate() == false && game.moves().length > 0){
		while (game.turn() == human){
			console.log("human turn");
			await sleep(1000);	
      if (force_stop) return ;
		}
		await sleep(500);
    if (force_stop) return ;
		console.log("ai turn");
		move = alphaBetaPruning(game.fen());
		// console.log(move);
		board.move(move.from + '-' + move.to);
		game.move(move);
		document.getElementById("history").innerHTML += "<h3 ><i class=\"fa-solid fa-computer\"></i> AI: " + move.from + " -> " + move.to + "</h3>";
    if (force_stop) return ;
		// await sleep(5000);
	}
	if (game.in_checkmate()){
		swal("Winner : " + game.turn());
	}
	else if (game.in_stalemate()){
		swal("Stalemate");
	}
	else {
		swal("Draw");
	}
}

function reset(){
  force_stop = true;
  document.getElementById("reset").setAttribute("disabled", "disabled");
  document.getElementById("resign").setAttribute("disabled", "disabled");
  document.getElementById("start").removeAttribute("disabled");
  document.getElementById("flip").removeAttribute("disabled");
  document.getElementById("difficulty").removeAttribute("disabled");
	board.position('start');
	game.reset();
	MAX_DEPTH = parseInt(document.getElementById("difficulty").value);
	document.getElementById("history").innerHTML = '<h1 style="border-bottom: 3px solid #555;">History</h1>';
}

function flip(){
	reset();
	board.flip();
	if (ai == 'w'){
		ai = 'b';
		human = 'w';
		
	}
	else {
		ai = 'w';
		human = 'b';
	}
}

function resign(){
  force_stop = true;
  document.getElementById("reset").setAttribute("disabled", "disabled");
  document.getElementById("resign").setAttribute("disabled", "disabled");
  document.getElementById("start").removeAttribute("disabled");
  document.getElementById("flip").removeAttribute("disabled");
  document.getElementById("difficulty").removeAttribute("disabled");

	swal("You Resigned");
	reset();
}

