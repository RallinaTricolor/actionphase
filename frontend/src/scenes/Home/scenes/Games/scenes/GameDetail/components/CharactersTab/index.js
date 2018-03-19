import React, {Component} from 'react';
import './index.scss';
import Signup from "../Signup";
import Character from "../Character";

class CharactersTab extends Component {
    render() {
        const characters = this.props.characters || [];
        return <div className="gameDetail__characters">
            {characters.map(character => <Character key={character.id} {...character}/>)}
        </div>
    }
}

export default CharactersTab;