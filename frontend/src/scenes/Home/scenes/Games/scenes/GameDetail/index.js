import React, {Component} from 'react';
import { connect } from 'react-redux'
import './index.scss';
import {gameList} from "../../../../../../actions/games";
import {games} from "../../../../../../reducers/games";
import Game from "./components/Game";

class GameList extends Component {
    componentDidMount() {
        this.props.fetchGames();
    }

    render() {
        const games = this.props.games || [];
        return <div className="games">
            <h2>Games</h2>
            {games.map(game => <Game key={game.id} {...game} />)}
        </div>
    }
}

export default connect(state => ({games: games(state)}), {fetchGames: gameList})(GameList);