import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import L from "leaflet";

const visitedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const pendingIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function TripMap({ clients }) {
  const clientsWithCoords = clients
    .map((client) => {
      const lat =
        client.partner_latitude ||
        client.visited_lat;

      const lng =
        client.partner_longitude ||
        client.visited_lng;

      return {
        ...client,
        mapLat: Number(lat),
        mapLng: Number(lng),
      };
    })
    .filter(
      (client) =>
        client.mapLat &&
        client.mapLng &&
        !Number.isNaN(client.mapLat) &&
        !Number.isNaN(client.mapLng)
    );

  if (clientsWithCoords.length === 0) {
    return (
      <div className="trip-map-empty">
        Todavía no hay ubicaciones registradas. Marcá una visita con ubicación
        para visualizarla en el mapa.
      </div>
    );
  }

  const center = [
    clientsWithCoords[0].mapLat,
    clientsWithCoords[0].mapLng,
  ];

  const route = clientsWithCoords.map((client) => [
    client.mapLat,
    client.mapLng,
  ]);

  return (
    <div className="trip-map-wrapper">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="trip-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {clientsWithCoords.length > 1 && (
          <Polyline positions={route} />
        )}

        {clientsWithCoords.map((client, index) => {
          const visited =
            client.visit_status === "Visitado";

          return (
            <Marker
              key={client.id}
              position={[client.mapLat, client.mapLng]}
              icon={visited ? visitedIcon : pendingIcon}
            >
              <Popup>
                <strong>
                  #{index + 1} {client.cliente}
                </strong>
                <br />
                {visited ? "Visitado" : "Pendiente"}
                <br />
                {client.visit_comment || ""}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}