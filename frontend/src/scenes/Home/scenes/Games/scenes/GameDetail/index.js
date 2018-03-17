import React, {Component} from 'react';
import { connect } from 'react-redux'
import './index.scss';
import {gameDetail} from "../../../../../../actions/games";
import {game} from "../../../../../../reducers/games";
import Game from "./components/Game";

class GameDetail extends Component {
    componentDidMount() {
        this.props.fetchGame(this.props.match.params.id);
    }

    render() {
        const game = this.props.game || [];
        return <div className="gameDetail">
            <h2>Game Details</h2>
            <Game key={game.id} {...game} />
        </div>
    }
}

export default connect(state => ({game: game(state)}), {fetchGame: gameDetail})(GameDetail);