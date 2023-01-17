/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + App.jsx                                                                    +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import {Route, Routes} from "react-router-dom";
import Home from "./pages/Home";
import {useState} from "react";
import {ColorSchemeProvider, LoadingOverlay, MantineProvider} from "@mantine/core";
import Keycloak from "keycloak-js";
import {ReactKeycloakProvider} from '@react-keycloak-fork/web'
import LinkPage from "./pages/Link";
import {NotificationsProvider} from "@mantine/notifications";
import {ModalsProvider} from "@mantine/modals";
import {ProvideAuth} from "./hooks/useUser";
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";
import {ErrorBoundary} from "./components/ErrorBoundary";

function App() {
    const keycloak = new Keycloak({
        "url": "https://auth.bte-germany.de", "realm": "btegermany", "clientId": "mapfrontend"
    });
    const [colorScheme, setColorScheme] = useState(window.localStorage.getItem("color-scheme") || "dark");
    const toggleColorScheme = (value) => {

        window.localStorage.setItem("color-scheme", value || (colorScheme === 'dark' ? 'light' : 'dark'));
        return setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));
    }

    return (<div>

        <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
            <MantineProvider theme={{colorScheme}} withGlobalStyles withNormalizeCSS>
                <NotificationsProvider>
                    <ModalsProvider>
                        <ErrorBoundary>
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
                        </ErrorBoundary>

                    </ModalsProvider>
                </NotificationsProvider>
            </MantineProvider>
        </ColorSchemeProvider>

    </div>)
}

export default App
