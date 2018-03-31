import React, {Component} from 'react';
import {connect} from 'react-redux'
import './index.scss';
import {gameList} from "../../../../../../actions/games";
import {games} from "../../../../../../reducers/games";
import Game from "./components/Game";
import {Loading} from "../../../../../../components/Loading";

class GameList extends Component {
    componentDidMount() {
        this.props.fetchGames();
    }

    render() {
        const games = this.props.games || [];
        if (!this.props.games) {
            return <Loading />
        }
        return <div className="games">
            <h2>Games</h2>
            <div className="game">
                <div className="game__attribute game__name game__name-header">
                    Name
                </div>
                <div className="game__attribute game__abbreviation game__abbreviation-header">
                    Abbreviation
                </div>
                <div className="game__attribute game__status game__status-header">
                    Status
                </div>
                <div className="game__attribute game__game_master game__game_master-header">
                    Game Master
                </div>
            </div>
            {games.map(game => <Game key={game.id} {...game} />)}
        </div>
    }
}

export default connect(state => ({games: games(state)}), {fetchGames: gameList})(GameList);