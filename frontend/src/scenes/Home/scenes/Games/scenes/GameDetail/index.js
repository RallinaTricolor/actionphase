import React, {Component} from 'react';
import { connect } from 'react-redux'
import './index.scss';
import {gameDetail} from "../../../../../../actions/games";
import {game, isGameMaster} from "../../../../../../reducers/games";
import GameDetailContainer from "./containers/Game";

class GameDetail extends Component {
    componentDidMount() {
        this.props.fetchGame(this.props.match.params.id);
    }

    render() {
        const game = this.props.game || [];
        return <GameDetailContainer className="gameDetailContainer" {...game}/>
    }
}

export default connect(state => ({game: game(state), isGameMaster: isGameMaster(state)}), {fetchGame: gameDetail})(GameDetail);