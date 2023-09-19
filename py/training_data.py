import chess
import chess.engine
import chess.pgn


def read_next_game(pgn_file):
    return chess.pgn.read_game(pgn_file)


def generate_moves_dataset(pgn_path, time_limit=0.05):
    evaluations = []
    with open(pgn_path) as pgn_file:
        game = read_next_game(pgn_file)
        with chess.engine.SimpleEngine.popen_uci("stockfish") as engine:
            while game:
                game_rows = []
                board = game.board()
                last_clock, this_clock = 180.0, 180.0
                for move in game.mainline():
                    board.push(move.move)
                    info = engine.analyse(board, chess.engine.Limit(time=time_limit))
                    eval_score = info["score"].relative.score(mate_score=10000)  # Using a high value for mate scores
                    evaluations.append(eval_score)
                    last_clock, this_clock = this_clock, move.clock()
                    row = [eval_score, last_clock, this_clock]
                    game_rows.append(row)

                # Write to CSV
                with open("output.csv", 'a') as f:
                    f.writelines([",".join(str(e) for e in row) + '\n' for row in game_rows])

                # Load the next game
                game = read_next_game(pgn_file)

    return evaluations


generate_moves_dataset('Late-Titled-Tuesday-Blitz-September-12-2023_2023-09-12-17-00.pgn')
