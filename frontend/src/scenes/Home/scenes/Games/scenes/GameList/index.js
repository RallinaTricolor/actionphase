import React, {Component} from 'react';
import {connect} from 'react-redux'
import {Link} from 'react-router-dom';
import './index.scss';
import {Row, Col, Button} from 'reactstrap';
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
                <Row className="games__title">
                    <Col md="8">
                        <h2>Games</h2>
                    </Col>
                    <Col md="4">
                        <Link to="/games/new">
                            <Button color="primary" active>Create Game</Button>
                        </Link>
                    </Col>
                </Row>
                <Row>
                    <Col sm="12">
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
            </Col>
        </Row>
    }
}

export default connect(state => ({games: games(state)}), {fetchGames: gameList})(GameList);