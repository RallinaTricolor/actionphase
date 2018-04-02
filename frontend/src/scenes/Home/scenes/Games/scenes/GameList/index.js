import React, {Component} from 'react';
import {connect} from 'react-redux'
import './index.scss';
import {Row, Col} from 'reactstrap';
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
            return <Loading/>
        }
        return <Row className="games">
            <Col sm="12">
                <h2>Games</h2>
                <Row className="game">
                    <Col sm="2" className="game__attribute game__name game__name-header">
                        Name
                    </Col>
                    <Col sm="2" className="game__attribute game__abbreviation game__abbreviation-header">
                        Abbreviation
                    </Col>
                    <Col sm="2" className="game__attribute game__status game__status-header">
                        Status
                    </Col>
                    <Col sm="2" className="game__attribute game__game_master game__game_master-header">
                        Game Master
                    </Col>
                </Row>
                {games.map(game => <Game key={game.id} {...game} />)}
            </Col>
        </Row>
    }
}

export default connect(state => ({games: games(state)}), {fetchGames: gameList})(GameList);