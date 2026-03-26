export function handleNotification(data: any, navigation: any) {
    switch (data.type) {
        case "INCIDENT":
            navigation.navigate("IncidentDetails", {
                id: data.id,
            });
            break;

        default:
            navigation.navigate("Home");
    }
}