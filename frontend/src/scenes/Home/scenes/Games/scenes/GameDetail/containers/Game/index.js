import React, { Component } from 'react';
import './index.scss';
import DetailsTab from "../../components/DetailsTab";

class GameDetailContainer extends Component {
    render() {
        return <DetailsTab {...this.props}/>
    }
}

export default GameDetailContainer;