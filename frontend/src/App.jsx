/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + App.jsx                                                                    +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import {Route, Routes} from "react-router-dom";
import Home from "./pages/Home";
import {useState} from "react";
import {ColorSchemeProvider, Loader, LoadingOverlay, MantineProvider} from "@mantine/core";
import Keycloak from "keycloak-js";
import {ReactKeycloakProvider} from '@react-keycloak/web'
import LinkPage from "./pages/Link";
import {NotificationsProvider} from "@mantine/notifications";
import {ModalsProvider} from "@mantine/modals";
import {ProvideAuth} from "./hooks/useUser";
import {SpotlightProvider} from "@mantine/spotlight";
import {AiFillHome} from 'react-icons/ai';
import {AiOutlineSearch} from 'react-icons/ai';
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";

function App() {
    const keycloak = new Keycloak({
        "url": "https://auth.bte-germany.de",
        "realm": "btegermany",
        "clientId": "mapfrontend"
    });
    const [colorScheme, setColorScheme] = useState('dark');
    const toggleColorScheme = (value) =>
        setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

    return (
        <div>

            <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                <MantineProvider theme={{colorScheme}} withGlobalStyles withNormalizeCSS>
                    <NotificationsProvider>
                        <ModalsProvider>

                            <ReactKeycloakProvider
                                authClient={keycloak}
                                LoadingComponent={<div style={{
                                    display: "absolute",
                                    top: "0",
                                    left: "0",
                                    zIndex: "9999",
                                    maxHeight: "100vh",
                                    maxWidth: "100vw"
                                }}>
                                    <LoadingOverlay visible={true}/>
                                </div>}
                            >
                                <ProvideAuth>
                                    <Routes>
                                        <Route path="/" element={<Home/>} exact/>
                                        <Route path="/link" element={<LinkPage/>} exact/>
                                        <Route path="/stats" element={<Stats/>} exact/>
                                        <Route path="/admin" element={<Admin/>} exact/>
                                    </Routes>
                                </ProvideAuth>
                            </ReactKeycloakProvider>

                        </ModalsProvider>
                    </NotificationsProvider>
                </MantineProvider>
            </ColorSchemeProvider>

        </div>
    )
}

export default App
