import React, {Component} from 'react';
import './index.scss';
import Signup from "../Signup";

class SignupsTab extends Component {
    render() {
        const signups = this.props.signups || [];
        return <div className="gameDetail__signups">
            {signups.map(signup => <Signup key={signup.id} {...signup}/>)}
        </div>
    }
}

export default SignupsTab;