import React, {Component} from 'react';
import { connect } from 'react-redux'
import './index.scss';
import {gameList} from "../../../../actions/games";
import {games} from "../../../../reducers/games";

class Games extends Component {
    componentDidMount() {
        this.props.fetchGames()
    }

    render() {
        return <div className="games">Games</div>
    }
}

export default connect(state => ({games: games(state)}), {fetchGames: gameList})(Games);